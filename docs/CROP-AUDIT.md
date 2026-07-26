# Crop Tool Audit — Diagnosis Report

**Scope:** `src/editor/AnnotateMode.tsx` (938 lines, single file — crop logic is not
split out into its own module). Diagnosis only; no code was changed as part of this
audit. All line numbers refer to the file as it currently stands on `main`.

---

## D1 — Crop toolbar button does nothing

**Root cause:** The toolbar button and the keyboard shortcut do **not** call the same
code path, and only one of them fully enters crop mode.

Every tool button is rendered through the generic `toolButton()` helper
(`src/editor/AnnotateMode.tsx:703-740`), whose `onClick` is uniform for all tools:

```
onClick={() => { if (!disabled) setActiveTool(tool); }}   // line 708
```

The crop button is instantiated at line 752 with this same generic handler:

```
{toolButton('crop', 'Crop', cropDisabled, cropDisabled ? 'Crop before annotating' : undefined)}
```

So clicking it only ever calls `setActiveTool('crop')`. But **none of the crop UI or
interaction logic is gated on `activeTool === 'crop'`.** It is gated entirely on a
separate boolean, `cropMode` (state declared at line 86):

- The sub-toolbar with Apply/Cancel only renders `{cropMode && (...)}` (line 785).
- The overlay/selection box only renders `{cropMode && cropSelection && (...)}` (line 841).
- `handleCropMouseDown/Move/Up` (lines 672-701) all early-return `if (!cropMode) return;`.
- `mainContentHeight` only shrinks for the sub-toolbar `if (cropMode)` (line 744).

The **keyboard** shortcut, by contrast, calls `startCropMode()` (line 473):

```
if (e.key.toLowerCase() === 'c') { if (!isDirty) startCropMode(); return; }
```

and `startCropMode()` (lines 583-587) is the function that actually flips `cropMode`:

```
function startCropMode() {
  setCropMode(true);
  setCropSelection(null);
  setActiveTool('crop');
}
```

So the keyboard path sets three pieces of state; the button click sets only one of
them (`activeTool`), and it is the one piece that nothing downstream reads. This is
why "C" works and the button does not — they are simply wired to different code.

**Secondary contributing issue — the disabled condition itself is too broad.** The
button's `disabled` prop comes from `cropDisabled = isDirty` (line 742), and `isDirty`
(line 123) is:

```
const isDirty = canvasDirty || detailsDirty;
```

`canvasDirty` correctly tracks `canvas.getObjects().length > 0` via
`updateCanvasDirty()` (lines 125-129), matching the intended spec. But `detailsDirty`
(lines 119-121) tracks whether the **Capture Details panel** has pending edits,
unrelated to whether the canvas has any drawn objects. So even on a perfectly empty
canvas, editing a metadata field (e.g. toggling a details checkbox) will set
`detailsDirty = true` → `isDirty = true` → the Crop button goes disabled, which
contradicts the documented intent ("condition is `canvas.getObjects().length > 0`").
This is not the primary defect (the user's report describes a click that produces "no
visual change," which only makes sense if the button was *not* disabled at the time —
otherwise the native `disabled` attribute would also block the keyboard shortcut, since
the keydown handler checks the same `isDirty` flag at line 473), but it is a real bug
that will resurface the moment this task also touches the details panel, and should be
fixed in the same pass.

**Minimal fix:**
1. Give the crop button its own `onClick` (not the generic `toolButton` handler) that
   calls `startCropMode()` instead of `setActiveTool('crop')` — or special-case
   `tool === 'crop'` inside `toolButton`'s `onClick`.
2. Change `cropDisabled = isDirty` to `cropDisabled = canvasDirty` so metadata-panel
   edits no longer block crop entry.

---

## D2 — Dim overlay is inverted

**Root cause:** There is exactly one overlay element, and it is positioned and sized
to exactly match the selection rectangle itself — not the area outside it.

```
{cropMode && cropSelection && (
  <div
    ref={cropRectRef}
    style={{
      position: 'absolute',
      left: cropSelection.x,
      top: cropSelection.y,
      width: cropSelection.width,
      height: cropSelection.height,
      border: '1px solid #ffffff',
      background: 'rgba(0,0,0,0.55)',   // line 851
      pointerEvents: 'none',
    }}
  >
    ...eight 8×8 handle squares (lines 855-862), decorative only...
  </div>
)}
```
(`src/editor/AnnotateMode.tsx:841-863`)

There is no second element, no four-rects-around-the-selection composition, and no
canvas-level masking/compositing — the mechanism is a single `<div>` whose bounding
box **is** the selection, filled with 55%-opacity black. That div sits directly over
the selected region and darkens exactly the area the user is trying to preview,
while everything outside it (the true canvas, unobstructed) stays at full brightness.
This is the literal inverse of the intended "spotlight" effect.

**Minimal fix:** Keep the same single `<div>` (it is already positioned/sized exactly
right for this trick) but replace the direct `background` fill with a CSS
`box-shadow` "spotlight" hack:

```
background: 'transparent',
boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
```

A `box-shadow` on an element extends outward in all directions and is clipped by the
element's own overflow — but since the overlay's *parent* container has
`overflow: 'hidden'` (line 832 on the container div), a sufficiently large spread
(`9999px`) reliably covers the entire visible container while leaving the div's own
interior (the selection) untouched/transparent. This requires no new elements, no
new state, and — importantly for the planned rewrite (see final section) — leaves the
selection `<div>` as the single hit-testable "body" element that a future drag-to-move
handler can attach to directly.

No four-separate-rects approach is needed; it would work too, but would add a second
DOM node to hit-test around when drag-to-move is implemented, for no benefit over the
box-shadow trick.

---

## D3 — Apply produces a blank popup (most serious defect)

**Root cause:** `canvas.clear()` is called *after* the new cropped background image is
assigned, and Fabric's `clear()` implementation resets `backgroundImage` back to
`undefined` as part of what it clears — silently undoing the assignment before
anything is ever painted.

Full path, `applyCrop()` (`src/editor/AnnotateMode.tsx:597-670`):

1. **Pixel source** (lines 626-636): the *original, natural-resolution* image element
   already attached as `canvas.backgroundImage` (`bgImg.getElement()`), drawn via 2D
   `ctx.drawImage(el, crop.x, crop.y, crop.width, crop.height, 0, 0, ...)` onto an
   off-screen `<canvas>`, exported via `toDataURL('image/jpeg', 0.95)`. This is
   correct — it always crops from the full-resolution source, never from a
   downscaled on-screen render.

2. **Coordinate space of the crop rect at the moment it's used** (lines 610-624): the
   selection (`cropSelection`, in on-screen/container-relative pixels) is converted to
   **image space** before being handed to `drawImage` — via `offsetX/offsetY` (the
   container-to-canvas DOM offset) and `invScale` (inverse of the fit-to-window
   display scale). This conversion is correct; by the time `crop.x/y/width/height` are
   used, they are natural-image pixel coordinates, not screen coordinates.

3. **What replaces the background image, and in what order** (lines 640-669, inside
   `img.onload` for the newly-cropped data URL):

   ```
   img.onload = () => {
     naturalSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight };  // 642
     handleResize();                                                          // 643
     const fabricImg = new fabric.FabricImage(img, { ... });                  // 644-651
     canvas.backgroundImage = fabricImg;                                      // 652 ← assigned
     canvas.clear();                                                          // 653 ← WIPES IT
     canvas.renderAll();                                                      // 654 ← paints nothing
     ...
   };
   ```

   Fabric's `Canvas.prototype.clear()` is documented and implemented (across the v4–v7
   line, including the v7 API this project pins) to reset **both** the object list
   **and** `backgroundImage`/`overlayImage`/`backgroundColor`/`overlayColor` to
   empty/`undefined`, in addition to clearing the 2D context's pixels. So the sequence
   above is: assign the new cropped image → immediately erase that assignment → render
   an empty canvas. The canvas *is* correctly resized to the new (smaller) cropped
   dimensions by `handleResize()` at line 643 (this part works), which is exactly why
   the symptom is "a correctly-sized, but completely blank, popup" rather than a
   wrong-size or off-screen image. `canvas.clear()`'s own `clearContext()` call also
   wipes any residual pixels, so there is nothing left to paint even transiently.

   **This is "never drawn," not "drawn but off-screen/zero-sized."** I determined this
   by reading the exact call order rather than the runtime behavior: `renderAll()`
   only fires once, at line 654, strictly *after* both the background assignment and
   the `clear()` that undoes it — so at the moment of the only paint call, there is
   nothing to paint. There is no scale or position bug in play here at all; the
   blank result is deterministic and would reproduce on every single Apply click, not
   intermittently or only near canvas edges.

4. **Is the assignment/render properly awaited?** Not applicable here — `img.onload`
   already guarantees the `Image` element is fully decoded before any of this code
   runs (same pattern used successfully for the initial image load at lines 239-282),
   and `canvas.backgroundImage = fabricImg` is a synchronous property assignment (not
   Fabric's async `setBackgroundImage()` helper), so there is no missing `await` for
   image decoding. The bug is purely the `clear()` ordering, not asynchrony.

5. **Secondary, non-symptom-causing oddity worth fixing in the same patch:**
   `handleResize()` is called at line 643 — *before* the new `fabricImg` is
   constructed — while `canvas.backgroundImage` still points at the **old**
   (pre-crop, larger) image. Inside `handleResize()` (lines 216-233), the line
   `canvas.backgroundImage.set({ scaleX: scale, scaleY: scale })` therefore rescales
   the *old* full-size image using a scale factor computed for the *new*, smaller
   natural size — a transient, wrong intermediate state. It causes no visible bug
   today only because it is immediately superseded by the subsequent (also broken)
   reassignment, but it should be cleaned up as part of the fix: call `handleResize()`
   *after* the new background image is assigned, not before.

**Minimal fix:** Reorder the three critical lines so `clear()` runs first, before any
new background is assigned, and move `handleResize()` to run after the new image is
in place:

```
canvas.clear();                 // wipe old objects/background first
canvas.backgroundImage = fabricImg;
handleResize();                 // now correctly rescales the NEW image
canvas.renderAll();
```

This single reordering also transitively fixes the crop entry in the undo/redo
history (see "Crop history entry" below), since the "after" JSON snapshot taken at
lines 656-658 is captured *after* this sequence — today it captures a
background-less canvas; once fixed, it will correctly capture the cropped image.

---

## D4 — Keyboard shortcut inventory

Full inventory of `handleKeyDown` (`src/editor/AnnotateMode.tsx:461-484`), each key
classified as requested:

| Key(s) | Line | Current action | Classification | Disposition |
|---|---|---|---|---|
| (focus guard: input/textarea/select/contentEditable) | 462-465 | early `return` | guard clause, not a shortcut itself | **Keep** — still needed to protect the operations below from firing while typing |
| `Escape` (while `cropMode`) | 468 | `cancelCrop()` | (b) editing operation | **Keep** |
| `Escape` (otherwise) | 471 | `handleExitRequest()` | (b) editing operation | **Keep** |
| `V` | 472 | `setActiveTool('select')` | (a) tool activation | **Remove** |
| `C` | 473 | `startCropMode()` (guarded by `!isDirty`) | (a) tool activation | **Remove** — this is the exact shortcut that conflicts with Cmd+C |
| `A` | 474 | `setActiveTool('arrow')` | (a) tool activation | **Remove** |
| `R` | 475 | `setActiveTool('rect')` | (a) tool activation | **Remove** |
| `M` | 476 | `setActiveTool('marker')` | (a) tool activation | **Remove** |
| `T` | 477 | `setActiveTool('text')` | (a) tool activation | **Remove** |
| `F` | 478 | `setActiveTool('rectFill')` | (a) tool activation | **Remove** |
| `Ctrl/Cmd+Z` | 479-480 | `undo()` | (b) editing operation | **Keep** |
| `Ctrl/Cmd+Shift+Z` | 480 (`e.shiftKey ? redo() : undo()`) | `redo()` | (b) editing operation | **Keep** |
| `Ctrl/Cmd+Y` | 482 | `redo()` | (b) editing operation | **Keep** |
| `Delete` / `Backspace` | 483 | `deleteSelected()` | (b) editing operation | **Keep** |

Net: **7 tool-activation branches to remove** (`V`, `C`, `A`, `R`, `M`, `T`, `F`);
**everything else stays**, including the `cropMode`-branch `Escape` handling and the
outer focus guard (the guard remains necessary because Delete/Backspace and
Ctrl/Cmd+Z/Y must still be suppressed while the user is typing in the Capture Details
panel's inputs).

No UI currently displays these shortcut letters anywhere (`toolButton()` shows no
shortcut hint text), so removing them requires no companion UI changes beyond the
handler itself.

---

## State inventory (crop-relevant)

| Name | Kind | Holds | Written by | Read by |
|---|---|---|---|---|
| `cropMode` | state (86) | whether crop UI/interaction is active | `startCropMode()` (585), `cancelCrop()` (590), `applyCrop()`'s `img.onload` (664) | canvas-interactivity effect (302-310), tool-mousedown effect (325, 414), render gates (785, 821→841, 744), `handleCropMouseDown/Move/Up` (673, 683, 698), keydown crop-branch (467) |
| `cropSelection` | state (84) | current selection rect, **container-relative screen pixels** `{x,y,width,height}` | `handleCropMouseDown` (679, zero-size seed), `handleCropMouseMove` (689-694), `startCropMode`/`cancelCrop` (reset to `null`) | overlay render (841-863), `applyCrop()` (601, 613-616), Apply-button disabled check (790, 798) |
| `cropDragging` | state (85) | whether a selection drag is in progress | `handleCropMouseDown` (678, true), `handleCropMouseUp`/`cancelCrop` (699/592, false) | `handleCropMouseMove` (683 guard) |
| `cropStartRef` | ref (87) | drag anchor point, same coordinate space as `cropSelection` | `handleCropMouseDown` (677), cleared by `handleCropMouseUp`/`cancelCrop` (700/593) | `handleCropMouseMove` (687-688) |
| `cropRectRef` | ref (88) | DOM ref attached to the overlay div (843) | attached via JSX `ref=` only | **never read** — dead ref, no `.current` access anywhere in the file. Either wire it up for the rewrite (e.g. direct hit-testing) or delete it. |
| `scaleRef` | ref (65) | fit-to-window display scale (displayed px / natural px) | initial load effect (248), `handleResize()` (224), (transiently, pre-fix, also mid-`applyCrop`) | `applyCrop()` invScale conversion (611), `exportAnnotatedImage()` invScale (521), new-image construction in `applyCrop` (645-646) |
| `naturalSizeRef` | ref (64) | natural pixel size of the *current* background image | initial load effect (243), `undo`/`redo` restore callbacks (154, 176), `applyCrop`'s `img.onload` (642) | `handleResize()` (219-220), `exportAnnotatedImage()` (517-518), `applyCrop()` (602-603) |
| `canvasDirty` | state (74) | `canvas.getObjects().length > 0` | `updateCanvasDirty()` (125-129), called from `saveHistory`, object add/remove handlers, undo/redo | `isDirty` (123), and — after the recommended D1 fix — `cropDisabled` directly |
| `historyRef` / `historyCursorRef` | refs (77-78) | JSON-snapshot undo/redo stack, generic to all canvas mutations including crop | `saveHistory()` (131-141), `applyCrop()`'s double-push (656-659) | `undo()`/`redo()` (143-185) |
| `containerRef` / `canvasRef` | DOM refs (61-62) | bounding boxes used to convert container-relative crop coordinates into canvas-relative / image-space coordinates | n/a (DOM) | `applyCrop()` offset calculation (605-608) |

### Is the crop history entry implemented, or silently skipped?

**Implemented, but currently corrupted by the D3 bug**, not skipped. The code at
lines 656-661 does push both a "before" snapshot (`snapshotBefore`, captured at line
638, *before* any mutation) and an "after" snapshot (`JSON.stringify(canvas.toJSON())`
at line 658, captured *after* the broken clear/assign sequence), and does correctly
advance `historyCursorRef.current` by 2 and enable `canUndo`. The mechanism itself
(push-two-snapshots, advance-cursor-by-two) is sound and mirrors how `saveHistory()`
works for ordinary annotation edits. The defect is only that, today, the "after"
snapshot is taken *after* `canvas.clear()` has already wiped `backgroundImage` — so it
records a background-less canvas, not the cropped image. Undo would restore to that
same broken, image-less state rather than the true post-crop image. Once the D3
reorder fix lands (clear → assign → resize → render), the "after" snapshot at line
658 will be taken from the correct, fully-populated canvas state, and crop
undo/redo should work correctly through the existing `undo()`/`redo()` machinery
(lines 143-185), which already has the necessary `bg instanceof fabric.FabricImage`
+ `naturalSizeRef` + `handleResize()` restoration logic in place for exactly this
case.

### Additional observation (not one of the four reported defects, adjacent to the rewrite)

`mainContentHeight` (lines 744-746) reduces the canvas container's allotted height by
an extra 32px whenever `cropMode` is true (to make room for the Apply/Cancel
sub-toolbar), but no effect calls `handleResize()` in response to `cropMode` changing
— the effect at lines 294-296 only depends on `[showPanel, handleResize]`. So the
actual Fabric canvas pixel dimensions/scale are not recalculated when entering or
exiting crop mode; only the CSS height of the surrounding container changes. This
does not currently produce a *reported* bug (the crop overlay computes its own
`getBoundingClientRect()` live, so its own positioning is self-correcting), but the
canvas itself may end up allotted less room than it was sized for while `cropMode` is
active, and is worth folding into the interaction rewrite since that work will already
be touching this exact area.

---

## Intended crop UX vs. current code — reuse assessment & rewrite-scope recommendation

**What's requested going forward:**
- Clicking Crop immediately enters crop mode *and* seeds a default selection
  (centered, 60% of image width/height) — no blind dragging required.
- Overlay dims outside the selection, never inside (→ D2 fix, already covered above).
- Dragging the selection **body** moves it; dragging one of the eight handles
  **resizes** it.
- Dragging on empty area (outside the current selection) still starts a fresh
  selection, replacing the old one.

**What exists today, concretely:**
- `startCropMode()` (583-587) always seeds `cropSelection: null` — there is no
  "default centered box" behavior at all today.
- `handleCropMouseDown` (672-680) **unconditionally** starts a brand-new zero-size
  selection at the click point, with no check for "did this click land inside the
  existing selection, or on a handle?" So today, clicking anywhere inside an existing
  selection to reposition it just replaces it with a fresh 0×0 box at that point —
  the literal opposite of "move."
- The eight little corner/edge squares (855-862) are purely decorative
  `pointerEvents: 'none'` `<div>`s with no click/drag handlers of their own and no
  hit-testing against them anywhere in the code. There is no resize-by-handle logic
  in any form today, not even a partial/broken attempt.

**Reuse assessment:** The coordinate-space plumbing is correct and fully reusable:
container-relative screen coordinates in `cropSelection`/`cropStartRef`, the
container-to-canvas DOM offset calculation (`offsetX`/`offsetY`, lines 605-608), and
the `invScale` conversion into natural-image-space (lines 610-624) used by
`applyCrop()`. None of that needs to change for the new interaction model — it stays
exactly as-is; only what happens *before* those conversions (i.e., how
`cropSelection` gets updated during a drag) needs new logic.

What's missing is a real amount of new logic, not present in any partial form today:
mousedown-time **hit-testing** to classify the click as (1) on a specific handle →
begin a resize anchored on the opposite corner/edge, (2) inside the existing
selection's body but not on a handle → begin a move, tracking the click offset
relative to the selection's top-left so the box translates without changing size, or
(3) on empty space outside the current selection → begin a brand-new selection
(today's only behavior). Each of these three modes needs its own `mousemove` update
formula, and the state needed to disambiguate the active drag mode does not exist yet
(no equivalent of a `dragMode: 'create' | 'move' | 'resize-tl' | 'resize-br' | ...`
piece of state, nor is the grabbed handle tracked anywhere).

**Recommendation: targeted patch for D1–D4, followed by a rewrite scoped to the crop
*interaction* subsystem only** — i.e., `startCropMode()`'s seeding behavior and the
`handleCropMouseDown/Move/Up` trio (plus new hit-testing helpers), **not** the
surrounding canvas fit-and-scale infrastructure (`handleResize`, `scaleRef`,
`naturalSizeRef`, the Fabric canvas setup in the main image-load effect, or the
undo/redo/history plumbing). Justification:

1. The fit-and-scale/history infrastructure is correct today (once D3's ordering bug
   is fixed) and is **shared** with every other tool in the editor (arrow, rect,
   marker, text, undo/redo, export-to-JPEG). Rewriting it risks regressing features
   that are not reported as broken, for no benefit — the four reported defects and
   the requested UX upgrade are entirely explainable by bugs/gaps local to the
   crop-specific state and handlers.
2. The D2 fix (box-shadow overlay on the single selection `<div>`) is a natural fit
   for the new interaction model: that same `<div>` becomes the element you attach a
   "start a move" mousedown handler to, and its eight handle children become real
   (currently decorative) resize grab-points once given their own small hit-test
   regions — so the D2 fix and the interaction rewrite reinforce each other rather
   than needing to be redone.
3. The new interaction logic (hit-testing + three drag modes) is genuinely additive —
   it does not require restructuring `cropSelection`'s shape (`{x,y,width,height}` in
   container-relative pixels is sufficient for all three modes) or introducing new
   refs beyond perhaps one small `dragModeRef` to track which handle/mode is active
   for the current gesture.

While in this area, also: wire up or delete the dead `cropRectRef` (currently
attached but never read), and consider calling `handleResize()` when `cropMode`
toggles so the canvas's actual pixel dimensions track the sub-toolbar's 32px height
change (see "Additional observation" above) — small, low-risk cleanups adjacent to
the same code the interaction rewrite will already be touching.
