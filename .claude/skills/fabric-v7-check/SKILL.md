---
name: fabric-v7-check
description: Use before writing or reviewing Fabric.js canvas code in src/editor/ (AnnotateMode.tsx, useDrawingTools.ts, useCropTool.ts, imageExport.ts) — checks for v5 API patterns that silently break under Fabric.js v7.4.0.
---

# Fabric.js v7 pitfall check

This project uses **Fabric.js 7.4.0**. v6/v7 introduced breaking changes vs v5 that don't show up as TypeScript errors or build failures — they show up as silently wrong runtime behavior (wrong crop region, frozen UI, canvas showing only the top-left corner). Source of truth: `docs/jirawm-spec.md` §5.8 — re-read it if this table and the file diverge.

## The table

| v5 API | Status | v7 fix |
|---|---|---|
| `fabric.Image.fromURL(url, callback)` | **BROKEN** | `fabric.FabricImage.fromURL(url)` returns a Promise |
| `canvas.setBackgroundImage(img, cb)` | **BROKEN** | `canvas.backgroundImage = img` (direct assignment) |
| `canvas.getPointer(e)` | **BROKEN** | `canvas.getScenePoint(e)` or `canvas.getViewportPoint(e)` |
| `canvas.loadFromJSON(json, callback)` | **BROKEN** | `canvas.loadFromJSON(json)` returns a Promise — use `.then()` |
| `canvas.setZoom(n)` | **RISKY** | Only applies viewport transform to objects; `backgroundImage` ignores zoom entirely |
| `canvas.toDataURL({format, quality})` | **RISKY** | TS type requires a `multiplier` field — add `multiplier: 1` |
| `new fabric.Rect({...})` without `originX/originY` | **RISKY** | v7 default is `center`; v5 default was `left`/`top` — always set explicitly |
| `new fabric.IText({...})` without `originX/originY` | **RISKY** | Same as Rect — text positions from center without an explicit origin |

## The expensive one: `setZoom` + `backgroundImage`

`setZoom` in v7 transforms objects but **not** `backgroundImage` — the background always renders at its own scale. Result: the editor shows only the upper-left corner of the screenshot regardless of zoom. Correct fix:

- Create the canvas at display dimensions (leave zoom at 1).
- Scale `backgroundImage` explicitly via `scaleX`/`scaleY` on the `FabricImage` object.
- For full-resolution export, use a temporary offscreen canvas at natural dimensions and clone objects scaled by `1/scale`.

## What to do

Before writing new canvas code, or when reviewing a diff touching `src/editor/`, grep for the broken/risky patterns:

```bash
grep -rn "fabric\.Image\.fromURL\|setBackgroundImage(\|getPointer(\|setZoom(\|new fabric\.Rect({\|new fabric\.IText({" src/editor/
grep -rn "loadFromJSON(" src/editor/   # then confirm it's chained with .then(), not a callback arg
```

Report each hit with file:line, whether it's the broken or risky variant, and the v7-correct replacement from the table above. If `setZoom` shows up anywhere near `backgroundImage`, flag it as the highest-priority issue — it's the one documented as most expensive to debug.
