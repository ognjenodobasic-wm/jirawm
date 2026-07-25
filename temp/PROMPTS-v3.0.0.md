# JiraWM — v3.0.0 Prompt Pack
## Faza 6 — Capture context & editor polish

> **How to use this file:** Execute tasks in the order given by the dependency graph below.
> Each task is a self-contained prompt inside a fenced block. Copy one block at a time.
> Do not start a task until all its dependencies are marked done.
> After each task: run `npx tsc --noEmit`, then `npm run build`, then commit.

---

## Dependency graph

```
T1 (types + shared primitives)  ← BLOCKING, must be first
 │
 ├─► T2 (image ingest pipeline)     ┐
 ├─► T3 (settings UI accordions)    │  these four can run in PARALLEL
 ├─► T4 (capture metadata collector)│
 └─► T7 (editor button logic)       ┘
        │
T2 ─────┼─► T6 (screenshot card UI)      ← needs T1 + T2
T2 ─────┴─► T9 (bulk numbering + ingest) ← needs T1 + T2
T4 ───────► T5 (ADF metadata block)      ← needs T1 + T4
T7 ───────► T8 (crop tool)               ← needs T7 (toolbar refactor)

T11 (Web Store permission model)         ← independent, can run any time after T1
T10 (help + version + changelog)         ← LAST, needs everything
```

**Parallel batches:**
- Batch A: T1 alone
- Batch B: T2, T3, T4, T7 (four agents in parallel)
- Batch C: T5, T6, T8, T9 (four agents in parallel)
- Batch D: T11 alone
- Batch E: T10 alone

---

## Decisions locked for this version

| Topic | Decision |
|---|---|
| Ingest format | Everything converts to JPEG on entry. One format through the whole system. |
| Ingest quality | Default 0.85, user-adjustable slider (0.6–1.0) |
| Editor export quality | Fixed 0.95, NOT configurable — avoids second-generation compression artifacts |
| Transparency fill | User choice: White (default) or Black |
| Numbering (single) | Monotonic counter, no renumbering on delete. 1,2,3 → delete 2 → next is 4 |
| Counter reset | Only after successful task creation |
| Numbering (bulk) | `{n} - {originalname}.jpg`, toggleable, default ON. DOES renumber on delete |
| Metadata block | Separate read-only section, merged into description ADF at submit time |
| Metadata position | User choice: bottom of description (default) or top |
| Metadata scope | Extension-captured screenshots only, never uploaded files |
| Viewport measurement | Derived arithmetically. NO `scripting` permission, NO content script |
| URL query params | Stripped by default |
| Crop | Disabled when canvas has objects. Tooltip explains. |
| Editor buttons | 0 objects → `[Close]`. 1+ objects → `[Cancel] [Save]` |
| Reorder | REMOVED — Jira does not preserve attachment order anyway |
| Tooltips | Shared `Tooltip` component, used wherever a control needs more than a label |

---

## Permission strategy — read before T4 and T11

The current manifest ships `"host_permissions": ["https://*.atlassian.net/*", "<all_urls>"]`.

`<all_urls>` produces the install warning **"Read and change all your data on all websites"** —
the heaviest warning Chrome has, and the main trigger for extended Chrome Web Store review.
Since the goal is real distribution, v3.0.0 does two things:

1. **Does not add `scripting`.** Viewport data is derived arithmetically instead
   (see T4). This keeps the permission surface from growing.
2. **Moves `<all_urls>` to `optional_host_permissions`** (see T11), requested on first
   capture. Install-time warnings drop to nothing meaningful.

Do not add `scripting`, `<all_urls>`, `webNavigation`, or `cookies` in any task in this pack.
If a task seems to need one, stop and flag it rather than adding it.

---

# T1 — Types, settings schema and shared primitives

**Depends on:** nothing · **Blocks:** everything · **Parallel:** no

```
# Prompt T1 — Types, settings schema and shared primitives
Model: kimi-k2.7-code

Foundation task for JiraWM v3.0.0. Types, settings storage, and two shared UI primitives
that later parallel tasks all need. Creating these here prevents four agents from
building the same component at once.

FILES TO MODIFY:
- src/types/index.ts
- src/lib/storage.ts

FILES TO CREATE:
- src/sidepanel/components/Tooltip.tsx
- src/sidepanel/components/Accordion.tsx

PART A — SETTINGS TYPES in src/types/index.ts

    export type TransparencyFill = 'white' | 'black';
    export type MetadataPosition = 'top' | 'bottom';

    export interface ImageSettings {
      quality: number;                     // 0.6 - 1.0, default 0.85
      maxWidth: number;                    // default 1920
      transparencyFill: TransparencyFill;  // default 'white'
    }

    export interface NamingSettings {
      numberSingleScreenshots: boolean;  // default true  -> 1.jpg, 2.jpg
      numberBulkFiles: boolean;          // default true  -> "1 - screenshot.jpg"
    }

    export interface CaptureDetailsSettings {
      enabled: boolean;              // master toggle, default true
      position: MetadataPosition;    // default 'bottom'
      includeUrl: boolean;           // default true
      includePageTitle: boolean;     // default true
      includeTimestamp: boolean;     // default true
      includeViewport: boolean;      // default true
      includeBrowser: boolean;       // default true
      stripQueryParams: boolean;     // default true
    }

    export interface AppSettings {
      image: ImageSettings;
      naming: NamingSettings;
      captureDetails: CaptureDetailsSettings;
    }

PART B — CAPTURE METADATA TYPES

    export interface CaptureMetadata {
      url: string | null;
      pageTitle: string | null;
      capturedAt: string;              // ISO 8601 with local offset
      viewportWidth: number | null;
      viewportHeight: number | null;
      devicePixelRatio: number | null;
      zoomFactor: number | null;       // 1 = 100%
      browser: string | null;          // e.g. "Chrome 138"
      os: string | null;               // e.g. "macOS 15.2"
    }

PART C — EXTEND ScreenshotItem

Keep every existing field. Add:

    origin: 'capture' | 'upload';
    number: number | null;             // sequence number, null when numbering is off
    filename: string;                  // final attachment filename, e.g. "1.jpg"
    metadata: CaptureMetadata | null;  // only when origin === 'capture'

PART D — STORAGE in src/lib/storage.ts

    export const DEFAULT_APP_SETTINGS: AppSettings = { ...defaults listed above... };
    export async function getAppSettings(): Promise<AppSettings>
    export async function saveAppSettings(settings: AppSettings): Promise<void>

- Storage area: chrome.storage.local. Key: 'jirawm_app_settings'.
- getAppSettings must DEEP MERGE stored values over DEFAULT_APP_SETTINGS so users
  upgrading from 2.x receive defaults for every new field without a migration script.
  Never assume a nested object exists in stored data.
- MIGRATION: the existing compression settings (quality, maxWidth) live under their own
  key. Read the old key once, map it into ImageSettings, write the new shape.
  Do not delete the old key in this task.

PART E — Tooltip component (src/sidepanel/components/Tooltip.tsx)

A small, reusable explanation affordance used across settings and forms.

    interface TooltipProps {
      text: string;
      children?: React.ReactNode;  // optional custom trigger
    }

- Default trigger when no children are passed: a 14x14 circle with a "?" glyph,
  1px solid var(--chrome-border), text var(--chrome-text-secondary), 10px font.
- Shows on hover AND on focus (keyboard accessible). Hides on blur, mouseleave, Escape.
- Bubble: background var(--chrome-text-primary), color #fff, 11px, 6px 8px padding,
  border-radius 4px, max-width 240px, line-height 1.4, box-shadow
  0 2px 8px rgba(0,0,0,0.2). Small arrow pointing at the trigger.
- Positioning: prefer above the trigger. The side panel is narrow (roughly 320-400px),
  so the bubble MUST flip below when there is not enough room above, and MUST clamp
  horizontally so it never overflows the panel edge. Measure with getBoundingClientRect
  against the panel viewport. This is the part most likely to be done wrong — test with
  a trigger near the top edge and near both side edges.
- The trigger is a <button type="button"> with aria-describedby wired to the bubble id.
- No portal, no external tooltip library. Plain absolutely positioned div.

PART F — Accordion component (src/sidepanel/components/Accordion.tsx)

    interface AccordionProps {
      title: string;
      tooltip?: string;           // renders a Tooltip next to the title when present
      defaultOpen?: boolean;      // default false
      children: React.ReactNode;
    }

- Header row: title left, optional Tooltip immediately after the title, chevron right.
  The whole row is the click target, rendered as a <button> with aria-expanded.
- Title: 13px, font-weight 500, var(--chrome-text-primary).
- Chevron: inline SVG, rotates 180deg on expand, CSS transition 150ms.
- Border-bottom 1px solid var(--chrome-border) on the header.
- Body: 8px vertical padding.
- Multiple accordions may be open simultaneously — this component holds its own state
  and does not coordinate with siblings.

CONSTRAINTS:
- TypeScript strict. No 'any'. No non-null assertions.
- Chrome CSS variables only. No Tailwind default colors. No icon or tooltip libraries.
- Do not modify any other component files in this task.
- Do not change existing exported type names, only extend them.

VERIFY: npx tsc --noEmit passes with zero errors. Build succeeds.

Na kraju uradi git commit sa porukom: feat: v3 types, settings schema, Tooltip and Accordion primitives
```

---

# T2 — Image ingest pipeline

**Depends on:** T1 · **Parallel with:** T3, T4, T7

```
# Prompt T2 — Unified image ingest pipeline
Model: kimi-k2.7-code

Create a single normalization function that every image passes through on entry.
After this task, no PNG ever exists inside the app — capture, drag-drop, and file picker
all produce JPEG immediately.

CREATE NEW FILE: src/lib/image.ts

Export one primary function:

    export async function normalizeImage(
      source: string | File | Blob,
      settings: ImageSettings
    ): Promise<{ dataUrl: string; width: number; height: number }>

BEHAVIOR — order matters:
1. Load source into an HTMLImageElement (handle dataUrl string, File, and Blob inputs).
2. Compute target size: if image width > settings.maxWidth, scale down proportionally.
   Never upscale. Round to integers.
3. Create a canvas at target size.
4. CRITICAL — fill the entire canvas with the transparency fill color BEFORE drawImage:
       ctx.fillStyle = settings.transparencyFill === 'black' ? '#000000' : '#ffffff';
       ctx.fillRect(0, 0, canvas.width, canvas.height);
   Without this, PNGs with alpha channels render with black edges in JPEG.
   Screenshot tools commonly produce PNGs with transparent window-shadow corners.
5. drawImage with the computed dimensions.
6. Export: canvas.toDataURL('image/jpeg', settings.quality)
7. Revoke any object URL created internally.

IMPORTANT — return the PRE-SCALE natural dimensions too, since T4 needs the original
captured pixel width to derive the viewport size:

    export async function readImageSize(dataUrl: string): Promise<{ width: number; height: number }>

Also export a filename helper:

    export function toJpegFilename(original: string): string

   Replaces any extension with .jpg. "bug-report.png" -> "bug-report.jpg".
   If there is no extension, appends .jpg. Sanitizes characters Jira rejects in
   attachment names: replace / \ : * ? " < > | with a hyphen.
   Truncate the basename to 80 characters, preserving the extension.

ERROR HANDLING:
- If the image fails to load (corrupt file, unsupported codec), reject with a
  descriptive Error. Callers show this per-file, and one bad file must never abort a batch.
- Animated GIFs flatten to their first frame. That is acceptable.

INTEGRATE — replace existing compression logic at these call sites so they all route
through normalizeImage:
- The screenshot capture path in src/sidepanel/SingleMode.tsx
- The file drop / file picker path in src/sidepanel/BulkMode.tsx
  BulkMode currently stores File objects and calls URL.createObjectURL for preview.
  After this change it must store the normalized JPEG dataUrl instead, and the preview
  img must use that dataUrl. Remove the URL.createObjectURL and URL.revokeObjectURL
  calls and their cleanup effects — they are no longer needed.
- Delete any now-unused older compression helper functions.

CONSTRAINTS:
- Pure module. No chrome.* API calls inside src/lib/image.ts.
- Settings are passed in as an argument, never read from storage inside this module.
- TypeScript strict. No 'any'.

VERIFY: npx tsc --noEmit passes. Build succeeds. Manual check: dropping a PNG with
transparency produces a JPEG with white (not black) background.

Na kraju uradi git commit sa porukom: feat: unified JPEG image ingest pipeline
```

---

# T3 — Settings UI with accordions

**Depends on:** T1 · **Parallel with:** T2, T4, T7

```
# Prompt T3 — Settings UI restructured into accordions
Model: kimi-k2.7-code

Rebuild src/sidepanel/Settings.tsx so the growing options list stays scannable.
Use the Accordion and Tooltip components created in T1 — do not build your own.

STRUCTURE (top to bottom):

  [ Jira connection ]        <- NOT an accordion, always visible, existing UI unchanged
      domain / email / API token / Test connection button

  [ v Image handling ]       <- accordion, collapsed by default
  [ v Screenshot naming ]    <- accordion, collapsed by default
  [ v Capture details ]      <- accordion, collapsed by default

SECTION 1 — Image handling
Accordion tooltip: "Every image is converted to JPEG when it enters the extension.
These settings control that conversion."

- Quality slider, range 0.6 to 1.0, step 0.05, default 0.85.
  Show the numeric value next to the label, e.g. "Quality — 0.85".
  Tooltip on the label: "Applies only when an image enters the extension. Annotations
  and crops are always saved at maximum quality, so editing never degrades an image twice."
- Max width, number input, default 1920, suffix "px".
- Transparent background fill, radio group: "White" (default) / "Black".
  Tooltip: "JPEG has no transparency. PNGs with transparent areas get this colour
  instead. White matches most screenshots; black suits dark-mode UIs."

SECTION 2 — Screenshot naming
Accordion tooltip: "Numbered attachments let you point at a specific image from the
task description."

- Checkbox: "Number screenshots in single tasks" (default on)
  Helper text: "Attachments are named 1.jpg, 2.jpg."
  Tooltip: "Numbers are never reused. If you delete the second screenshot, the next
  one you take is 4 — so anything already written referring to an image stays correct."
- Checkbox: "Number files in bulk upload" (default on)
  Helper text: "Prefixes uploaded filenames, e.g. 1 - login-error.jpg"

SECTION 3 — Capture details
Accordion tooltip: "A short block describing the conditions the screenshot was taken in."

- Master toggle: "Add capture details to description" (default on)
  Tooltip (IMPORTANT, user specifically asked for this one): "These details are not
  typed into the description box — they are generated and merged into the description
  when the task is created. You cannot edit them, and they always match the screenshots
  actually attached."
  Helper text: "Only applies to screenshots taken with the extension, never to uploaded files."

- When the master toggle is OFF, HIDE the sub-options entirely. Do not render them
  disabled — five greyed-out checkboxes are visual noise.

- When ON, show:
    Position, radio group: "End of description" (default) / "Start of description"
    Then checkboxes, all default on:
      Page URL
      Page title
      Timestamp
      Viewport and zoom
        Tooltip: "Measured from the screenshot itself, so it reflects the page area as
        captured. Note that an open side panel narrows the page, so this is the width
        with the panel open."
      Browser and OS
    Then, indented under Page URL and only visible when Page URL is checked:
      "Strip query parameters from URL" (default on)
        Tooltip: "Removes everything after the ? — URLs often carry session tokens you
        do not want pasted into a ticket."

PERSISTENCE:
- Read via getAppSettings() on mount.
- Save on change with a 400ms debounce. No explicit Save button for these three sections.
- Show a transient "Saved" indicator (fades after 1.5s) in the section header on write.
- The Jira connection section keeps its existing explicit save behavior.

STYLING: Chrome CSS variables only. No Tailwind default colors. No icon libraries.

CONSTRAINTS:
- TypeScript strict. No 'any'.
- Do not touch Jira auth logic, only lay it out above the accordions.
- Do not create a Tooltip or Accordion component — import them from
  src/sidepanel/components/.

VERIFY: npx tsc --noEmit passes. All three sections persist across panel close/reopen.
Tooltips near the panel edges stay fully visible.

Na kraju uradi git commit sa porukom: feat: accordion settings with tooltips for image, naming and capture details
```

---

# T4 — Capture metadata collector (no new permissions)

**Depends on:** T1 · **Parallel with:** T2, T3, T7

```
# Prompt T4 — Capture metadata collector without new permissions
Model: kimi-k2.7-code

Collect page context at screenshot capture time, for extension-captured screenshots only.

CRITICAL CONSTRAINT — DO NOT add the "scripting" permission and DO NOT inject a content
script. The extension is heading for Chrome Web Store distribution and the permission
surface must not grow. Viewport data is derived arithmetically instead. If you think
you need executeScript, you do not — read the derivation below.

CREATE NEW FILE: src/lib/capture-metadata.ts

    export async function collectCaptureMetadata(
      tabId: number,
      capturedImageWidth: number,
      capturedImageHeight: number,
      settings: CaptureDetailsSettings
    ): Promise<CaptureMetadata>

BEHAVIOR:

1. If settings.enabled is false, return early with every field null except capturedAt.

2. URL and title, from chrome.tabs.get(tabId):
   - If settings.includeUrl is false, url is null.
   - If settings.stripQueryParams is true, parse with the URL constructor and rebuild as
     origin + pathname, dropping search and hash. Wrap in try/catch — some tab URLs are
     not parseable; fall back to the raw string.
   - If settings.includePageTitle is false, pageTitle is null.

3. capturedAt — always set. ISO 8601 with the LOCAL timezone offset, not UTC. The user
   wants the time they took the screenshot.

4. VIEWPORT DERIVATION — only if settings.includeViewport is true.

   chrome.tabs.captureVisibleTab returns the viewport rendered at physical resolution:

       imageWidthPhysical = cssViewportWidth * zoomFactor * displayDevicePixelRatio

   Therefore:

       cssViewportWidth  = round(capturedImageWidth  / (dpr * zoom))
       cssViewportHeight = round(capturedImageHeight / (dpr * zoom))

   Where:
   - zoom comes from await chrome.tabs.getZoom(tabId). Requires no extra permission.
     Wrap in try/catch, fall back to 1.
   - dpr comes from window.devicePixelRatio read in the SIDE PANEL context.
     This is valid because the side panel is docked inside the same browser window as
     the tab, so it is always on the same display and therefore the same DPR.
     Do not try to read DPR from the page.

   Store the derived cssViewport values in viewportWidth / viewportHeight, the raw dpr
   in devicePixelRatio, and the zoom in zoomFactor.

   ACCURACY NOTE — put this in a code comment: rounding can be off by about 1px because
   of scrollbar width and subpixel layout. That is acceptable for the intended use.

   IMPORTANT — capturedImageWidth must be the dimensions of the RAW captured image,
   read BEFORE normalizeImage downscales it to maxWidth. Use readImageSize() from
   src/lib/image.ts on the raw capture result. Passing the downscaled width here would
   silently report a wrong viewport, and it would look plausible — this is the single
   most likely bug in this task.

5. Browser and OS — only if settings.includeBrowser is true.
   Prefer navigator.userAgentData (brands + platform) when available; fall back to
   parsing navigator.userAgent. Produce short readable strings:
       browser: "Chrome 138"
       os: "macOS 15.2" or "Windows 11" or "Linux"
   If parsing yields nothing recognizable, set the field to null rather than dumping
   the raw UA string.

INTEGRATE:
In the capture flow in src/sidepanel/SingleMode.tsx:
  a. await chrome.tabs.captureVisibleTab -> raw dataUrl
  b. readImageSize(rawDataUrl) -> raw width and height
  c. collectCaptureMetadata(tabId, rawWidth, rawHeight, settings)
  d. normalizeImage(rawDataUrl, imageSettings) -> stored dataUrl
  e. build the ScreenshotItem with origin: 'capture' and the metadata attached

For uploaded files, always set metadata: null and origin: 'upload'.

CONSTRAINTS:
- Every chrome.* call individually wrapped in try/catch. A single failure degrades one
  field, never the whole object, and never blocks the capture.
- No "scripting" permission. No content scripts. No manifest changes at all in this task.
- No 'any'.

VERIFY: npx tsc --noEmit passes. On a 1440px-wide page at 100% zoom with the side panel
open, the reported viewport roughly matches the visible page width (narrower than 1440
by the panel width, which is correct). At 150% zoom the reported width drops accordingly.
Capturing a chrome:// page still succeeds.

Na kraju uradi git commit sa porukom: feat: permission-free capture metadata via arithmetic viewport derivation
```

---

# T5 — ADF metadata block and description merge

**Depends on:** T1, T4 · **Parallel with:** T6, T8, T9

```
# Prompt T5 — ADF capture details block and description merge
Model: kimi-k2.7-code

Build the capture details block and merge it into the Jira description at submit time.
The description textarea stays untouched — the block is generated, never hand-edited.

CREATE: src/lib/capture-adf.ts

    export function buildCaptureDetailsADF(
      screenshots: ScreenshotItem[]
    ): ADFNode[] | null

BEHAVIOR:
- Filter to screenshots where origin === 'capture' AND metadata !== null.
- If none remain, return null and the caller appends nothing.
- Otherwise return an array of ADF nodes:
  1. A rule node (horizontal divider): { type: 'rule' }
  2. A paragraph with bold text "Captured with JiraWM"
  3. For each qualifying screenshot, in order:
     - A paragraph with the filename in strong marks (e.g. "1.jpg")
     - A bulletList with one listItem per non-null metadata field:
           URL — {url}
           Page — {pageTitle}
           Captured — {formatted local datetime}
           Viewport — {w}x{h} · DPR {dpr} · zoom {zoom}%
           Browser — {browser} · {os}
     - Skip any field whose value is null. Never render "URL — null".
     - Combine viewport, DPR and zoom into ONE list item. If only some of the three are
       available, render only those parts.
     - Omit the zoom segment when the factor is exactly 1 — "zoom 100%" is noise.

- Use bulletList, NOT codeBlock. Code blocks read like pasted logs in the Jira UI.
- Format the timestamp human-readably, e.g. "2026-07-25 14:32 CEST", not raw ISO.

MERGE INTO DESCRIPTION:
Locate the existing toADF() helper used for the description field. Add:

    export function buildDescriptionADF(
      userText: string,
      screenshots: ScreenshotItem[],
      position: MetadataPosition
    ): ADFDoc

- Convert the user's text with the existing toADF logic.
- If buildCaptureDetailsADF returns non-null, place those nodes AFTER the user content
  when position is 'bottom', or BEFORE it when position is 'top'.
- When position is 'top', the rule node goes AFTER the details block rather than before
  it, so the divider always sits between the two sections rather than at the document edge.
- If userText is empty but capture details exist, still produce a valid document
  containing only the details block.
- Jira rejects an empty content array — if there is genuinely nothing to send, emit a
  document with a single empty paragraph.

Wire this into the create-issue path in src/sidepanel/SingleMode.tsx, reading position
from getAppSettings().captureDetails.position.
Bulk mode is unaffected — bulk screenshots are uploads and never carry metadata.

READ-ONLY PREVIEW IN THE PANEL:
Below the description textarea in SingleMode, render a collapsed summary row:

    [ v ] Capture details — 3 screenshots   (?)

- Only render when at least one screenshot has metadata.
- The (?) is the shared Tooltip component from T1, with this text:
      "These details are not part of the text above. They are generated from the
      screenshots and merged into the description when the task is created."
- Expanding shows the same information as plain read-only text, 11px,
  var(--chrome-text-secondary).
- Display only. No edit affordance. It regenerates from state on every render, so it
  can never drift from what is actually sent.

CONSTRAINTS:
- Type the ADF node shapes properly. No 'any', no Record<string, unknown>.
- Pure functions in capture-adf.ts. No chrome.* calls, no React.

VERIFY: npx tsc --noEmit passes. Creating a task with two captured screenshots and one
uploaded file produces a description with details for exactly the two captured ones.
Switching position to 'top' moves the block above the user text with the divider between.

Na kraju uradi git commit sa porukom: feat: ADF capture details block with configurable position
```

---

# T6 — Screenshot card UI in Single mode

**Depends on:** T1, T2 · **Parallel with:** T5, T8, T9

```
# Prompt T6 — Screenshot card with horizontal scroll and dual capture buttons
Model: kimi-k2.7-code

Restructure the screenshot area in src/sidepanel/SingleMode.tsx into a bounded card.
Horizontal scroll needs a visual container or it reads as broken layout.

REMOVE FIRST:
All drag-and-drop reorder logic for thumbnails — drag handlers, drag state, reorder
helpers. Jira does not preserve attachment order, so the feature has no payoff.
Delete it, do not comment it out.

CARD STRUCTURE:

    +-- Screenshots (3/10) (?) ----- [Capture] [Add] --+
    |  +----+ +----+ +----+ +---                       |
    |  | 1  | | 2  | | 3  | | 4   ->  scrolls          |
    |  +----+ +----+ +----+ +---                       |
    +---------------------------------------------------+

- Card: 1px solid var(--chrome-border), border-radius 8px, background var(--chrome-bg)
- Header row: 8px 10px padding, border-bottom 1px solid var(--chrome-border)
  - Left: "Screenshots" 12px font-weight 500 var(--chrome-text-primary), then a count
    "(3/10)" in var(--chrome-text-secondary), then the shared Tooltip from T1 with:
        "Up to 10 per task. Screenshots you capture here also record the page URL,
        viewport and browser. Files you add from disk do not."
  - Right: two buttons, below
- Body: 8px padding, display flex, gap 8px, overflow-x auto, overflow-y hidden
  - Thumbnails keep their CURRENT size. Do not resize them.
  - flex-shrink: 0 on each thumbnail so they never compress
  - Custom thin scrollbar: 6px height, thumb var(--chrome-border), transparent track

BUTTONS IN HEADER:
- "Capture" — PRIMARY. background var(--chrome-blue), white text, no border.
  Triggers the existing chrome.tabs.captureVisibleTab flow.
- "Add" — SECONDARY. transparent background, 1px solid var(--chrome-border),
  text var(--chrome-text-primary). Opens a hidden file input (accept="image/*", multiple).
  Selected files go through normalizeImage() from src/lib/image.ts, then are added as
  ScreenshotItem with origin: 'upload' and metadata: null.
- Both: 11px font, 4px 10px padding, border-radius 4px.
- Both disabled at 10 screenshots. Disabled: opacity 0.5, cursor not-allowed, and the
  count label turns var(--chrome-red).

SCROLL AFFORDANCE:
A 24px right-edge gradient fade (transparent to var(--chrome-bg)), absolutely positioned,
visible ONLY when the body is horizontally overflowing AND not scrolled to the end.
Track with a scroll listener plus a ResizeObserver on the scroll container.
pointer-events: none on the overlay.

THUMBNAIL TILE:
Keep the existing size and click behavior (click opens the editor). Add:
- Sequence number badge, bottom-left, only when numbering is enabled in settings:
  white text on rgba(0,0,0,0.6), 10px, 2px 5px padding, border-radius 3px.
  Shows ScreenshotItem.number, NOT the array index — numbers do not renumber on delete.
- Annotated indicator, top-left: a small pencil glyph on the same dark pill, shown when
  the item has been annotated.
- Remove button, top-right, visible on hover: 16x16 circle, var(--chrome-red) background,
  white x. Removes the item WITHOUT renumbering the others.

NUMBERING:
- Maintain a monotonic counter in SingleMode state. Each new screenshot (captured OR
  uploaded) takes the next number.
- Deleting does NOT free a number. 1,2,3 with 2 deleted, next capture is 4.
- The counter resets to 1 only after a task is created successfully.
- Read naming.numberSingleScreenshots from getAppSettings(). When disabled, number is
  null and the original filename is used ("screenshot.jpg" for captures).
- When enabled, filename is "{number}.jpg" for captures; uploads keep their original
  name since the badge already provides the reference.

EMPTY STATE:
No screenshots -> render inside the card body, do not hide the card. Centered, 11px,
var(--chrome-text-secondary): "No screenshots yet — capture the page or add a file."

CONSTRAINTS:
- Chrome CSS variables only. No Tailwind default colors. No icon libraries.
- Import Tooltip from src/sidepanel/components/, do not rebuild it.
- TypeScript strict. No 'any'.

VERIFY: npx tsc --noEmit passes. Four thumbnails fit without scroll; the fifth triggers
scroll and the fade appears. Deleting the second of three leaves badges 1 and 3.

Na kraju uradi git commit sa porukom: feat: screenshot card with horizontal scroll, capture and add buttons
```

---

# T7 — Editor button state machine and export quality

**Depends on:** T1 · **Parallel with:** T2, T3, T4

```
# Prompt T7 — Editor unified button logic and fixed export quality
Model: kimi-k2.7-code

Collapse the preview/annotate split into a single editor mode with context-aware buttons.

DELETE:
- src/editor/PreviewMode.tsx — remove the file entirely
- The 'mode' query parameter handling and all mode-based routing in
  src/editor/AnnotationEditor.tsx
- The EditorMode type from src/types/index.ts and the mode field on PendingEditor
- Any "Preview" button in src/sidepanel/SingleMode.tsx — a thumbnail click now opens the
  editor directly, with no intermediate choice

AnnotationEditor.tsx becomes a thin wrapper that reads pendingEditor from storage and
renders AnnotateMode. No branching.

BUTTON STATE MACHINE in src/editor/AnnotateMode.tsx:

Derive one boolean: isDirty = canvas.getObjects().length > 0
Recompute on every Fabric event that adds or removes objects — 'object:added',
'object:removed' — and after undo/redo.
Do NOT track "has the user interacted". Object count is the only source of truth, so
undoing back to an empty canvas correctly returns the buttons to the clean state.

  isDirty === false:
      [ Close ]                <- secondary style, closes immediately, no confirm
  isDirty === true:
      [ Cancel ]  [ Save ]     <- Cancel secondary, Save primary (var(--chrome-blue))

- Save: export the canvas, write the result, close the window.
- Cancel: show a confirm dialog "Discard annotations? This can't be undone."
  Confirmed -> close without saving. Dismissed -> stay in the editor.
- Escape and the window titlebar close BOTH route through the same logic as the
  currently displayed left button. Clean state closes silently; dirty state shows the
  same confirm. Three exits must not have two behaviors.
  For the titlebar close, use a beforeunload handler to trigger the confirm.

EXPORT QUALITY — the important part:
The source image already went through JPEG compression at ingest (default 0.85).
Re-exporting at the same quality stacks artifacts, highly visible on screenshot text,
and it compounds with every crop.

    canvas.toDataURL('image/jpeg', 0.95)

Hardcode 0.95. Do NOT read the quality slider here and do NOT make it configurable —
the user has no way to reason about a second-pass quality value. Add a code comment
explaining this so it does not get "fixed" later.

BUTTON STYLING:
- Both: 12px font, 6px 14px padding, border-radius 4px, top-right of the toolbar, 8px gap.
- Primary: background var(--chrome-blue), white text, no border. Hover var(--chrome-blue-hover).
- Secondary: transparent, 1px solid var(--chrome-border), text var(--chrome-text-primary).
- The confirm dialog is an in-editor overlay, NOT window.confirm(). Centered card,
  semi-transparent backdrop, message plus [ Keep editing ] [ Discard ] where Discard
  uses var(--chrome-red).

CONSTRAINTS:
- Do not touch the crop tool in this task — it is added in T8.
- Do not change existing drawing tool behavior.
- TypeScript strict. No 'any'.

VERIFY: npx tsc --noEmit passes. Opening a screenshot and closing without drawing shows
only Close and exits with no prompt. Drawing one arrow switches to Cancel/Save. Undoing
that arrow switches back to Close.

Na kraju uradi git commit sa porukom: feat: unified editor with context-aware buttons and fixed export quality
```

---

# T8 — Crop tool

**Depends on:** T7 · **Parallel with:** T5, T6, T9

```
# Prompt T8 — Crop tool as first item in editor toolbar
Model: kimi-k2.7-code

Add a crop tool to src/editor/AnnotateMode.tsx. Chrome has no region-capture API, so
cropping in the editor is how users isolate a region — and unlike a page overlay, it
also works on files uploaded from disk and on restricted pages.

TOOLBAR POSITION:
Crop is the FIRST item, before Select. Show an icon AND the text label "Crop" — this is
a new capability nobody expects in that toolbar, and a bare icon would go unnoticed.
Insert a separator after it, then the existing tools unchanged.

    [ (icon) Crop ] | [ Select ] [ Arrow ] [ Rect ] [ Marker ] [ Text ] | ...

AVAILABILITY RULE:
Crop is DISABLED whenever canvas.getObjects().length > 0.
- Disabled style: opacity 0.4, cursor not-allowed
- title attribute: "Crop before annotating"
- Do not hide the button — a visible disabled control teaches the correct order.
Rationale: cropping away annotated regions would silently destroy work, and clipping
shapes at the crop edge looks broken. Crop-first is enforced.

CROP MODE INTERACTION:
1. Activating Crop enters a dedicated mode. Disable all drawing tools and object
   selection while active.
2. The user drags a rectangle over the image. While dragging and after release:
   - Area OUTSIDE the selection is dimmed with rgba(0,0,0,0.55)
   - Selection border 1px solid #ffffff
   - Eight resize handles (corners plus edge midpoints), 8x8 white squares with a
     1px rgba(0,0,0,0.4) border
   - The selection can be dragged as a whole to reposition
   - The selection is clamped to the image bounds and can never extend past the edge
3. Toolbar switches to crop-specific actions while in crop mode:
       [ Apply ]  [ Cancel ]
   - Apply performs the crop
   - Cancel exits crop mode, discards the selection, restores the normal toolbar
   - Escape behaves as Cancel
4. A selection smaller than 20x20 px is ignored as a stray click. Apply stays disabled
   until a valid selection exists.

APPLYING THE CROP:
1. Read the selection in IMAGE coordinate space, not screen space. The canvas is
   displayed fit-to-window and may be scaled — divide the screen-space rect by the
   current display scale factor before cropping.
   THIS IS THE MOST LIKELY BUG IN THIS TASK. Verify explicitly with an editor window
   smaller than the source image; a wrong scale factor crops a plausible-looking but
   incorrect region.
2. Draw the selected region from the source image onto a new canvas at natural size.
3. Replace the editor background image with the cropped result and resize the Fabric
   canvas to the new dimensions.
4. Re-fit the canvas to the window afterwards.
5. Push the crop onto the SAME undo history stack the drawing tools use, as a single
   step. Undo after a crop must restore BOTH the previous image AND the previous canvas
   dimensions.
6. Return to the Select tool automatically after Apply.

MULTIPLE CROPS:
Cropping an already-cropped image is allowed, each as a separate undo step. Accumulated
quality loss is why T7 fixes editor export at 0.95 rather than the ingest quality.

CONSTRAINTS:
- No external cropping library. Fabric plus a plain canvas is sufficient.
- Keyboard shortcut: C activates crop when enabled.
- TypeScript strict. No 'any'.

VERIFY: npx tsc --noEmit passes. Crop then annotate works. Annotate then crop is blocked
with the tooltip. Undo after crop restores the full image. Crop is accurate when the
editor window is smaller than the source image.

Na kraju uradi git commit sa porukom: feat: crop tool with image-space accuracy and undo support
```

---

# T9 — Bulk numbering and ingest conversion

**Depends on:** T1, T2 · **Parallel with:** T5, T6, T8

```
# Prompt T9 — Bulk file numbering prefix
Model: mimo-v2.5

Apply numbering prefixes to bulk-uploaded files in src/sidepanel/BulkMode.tsx.
In bulk mode the numbers are reference markers for writing descriptions, not an
ordering guarantee.

NAMING:
- Read naming.numberBulkFiles from getAppSettings().
- When enabled (default), the attachment filename becomes:
      "{n} - {original basename}.jpg"
  Example: "login-error.png" as the third file becomes "3 - login-error.jpg"
- When disabled, use the converted original name: "login-error.jpg"
- Numbering is assigned in the order files enter the list, starting at 1.
- Unlike single mode, bulk numbering DOES renumber on removal, because bulk numbers are
  positional labels in a flat table with no metadata block referencing them. Removing
  row 2 of 3 leaves rows numbered 1 and 2.
- Run the name through toJpegFilename() from src/lib/image.ts for sanitization and length
  truncation. Apply the prefix AFTER sanitizing the basename, so the number is never
  truncated away.

UI:
- Show the final attachment filename in the row, replacing the current raw file.name
  display. Truncate with ellipsis on overflow; put the full name in a title attribute.
- The existing "#N" row index label becomes redundant once the filename carries the
  number — remove it.

INGEST:
Confirm files already route through normalizeImage() from T2 and that rows store the
normalized JPEG dataUrl rather than a File object plus object URL. If T2 left any
createObjectURL or revokeObjectURL calls behind in this file, remove them along with
their cleanup effects.

The base64 conversion in buildTasks() should now be a passthrough — the dataUrl is
already normalized, so the old fileToBase64 call is redundant. Remove it, pass the
stored dataUrl straight through, and delete fileToBase64 if it has no other callers.

CONSTRAINTS:
- Do not change bulk upload processing logic, status flow, or retry behavior.
- TypeScript strict. No 'any'.

VERIFY: npx tsc --noEmit passes. Dropping three PNGs yields rows named "1 - name.jpg",
"2 - name.jpg", "3 - name.jpg". Removing the middle row renumbers the remaining two to
1 and 2.

Na kraju uradi git commit sa porukom: feat: bulk file numbering prefix
```

---

# T11 — Chrome Web Store permission model

**Depends on:** T1 · **Parallel:** independent, can run any time after T1

```
# Prompt T11 — Move <all_urls> to an optional permission for Web Store readiness
Model: kimi-k2.7-code

The extension currently ships "<all_urls>" in host_permissions. At install this shows
"Read and change all your data on all websites" — the heaviest warning Chrome has, and
the main trigger for extended Chrome Web Store review. The extension is intended for
real distribution, so this must become an optional permission granted on first use.

MANIFEST CHANGES:

  "host_permissions": ["https://*.atlassian.net/*"]
  "optional_host_permissions": ["<all_urls>"]

Keep "activeTab" in permissions. Do NOT add "scripting".
The atlassian.net host permission stays required — the extension is useless without it
and the warning it produces names only that one domain.

WHY <all_urls> IS NEEDED AT ALL:
chrome.tabs.captureVisibleTab requires either activeTab or a host permission for the
target tab. activeTab is granted only when the user invokes the extension (action click,
keyboard command) and is revoked on tab switch or navigation. Because the side panel
stays open while the user moves between tabs, activeTab alone is unreliable here.
That is why the broad permission exists — it just should not be an install-time demand.

IMPLEMENT A PERMISSION GATE:

Create src/lib/permissions.ts:

    export async function hasCapturePermission(): Promise<boolean>
    export async function requestCapturePermission(): Promise<boolean>

- hasCapturePermission wraps chrome.permissions.contains({ origins: ['<all_urls>'] })
- requestCapturePermission wraps chrome.permissions.request({ origins: ['<all_urls>'] })
  IMPORTANT: chrome.permissions.request MUST be called synchronously from within a user
  gesture handler. Do not await anything before calling it inside the click handler, or
  Chrome silently rejects the request. Check the cached permission state beforehand and
  branch on it, rather than awaiting contains() inside the click path.

WIRE INTO THE CAPTURE FLOW in src/sidepanel/SingleMode.tsx:
- On mount, check hasCapturePermission() and store the result in state.
- If permission is missing, the "Capture" button click first calls
  requestCapturePermission() directly, then proceeds with the capture on success.
- If the user declines, show a non-blocking inline message in the screenshot card:
      "Screenshot capture needs permission to read the current page. Use Add to upload
      an image instead, or click Capture again to grant it."
  Do not use an alert or a modal. Do not repeat the prompt automatically.
- The "Add" upload path and the entire Bulk tab must keep working with no permission at
  all. Verify this — a declined permission must not break half the extension.

ADD A SETTINGS ROW:
In the Jira connection section of Settings (above the accordions), add a status line:

    Page access — Granted / Not granted   [ Grant ]

- "Grant" button visible only when not granted, calls requestCapturePermission().
- Tooltip (shared component from T1): "Needed to take screenshots of the page you are
  on. Uploading files works without it."

CONSTRAINTS:
- No other permissions added or removed.
- Do not change any Jira API logic.
- TypeScript strict. No 'any'.

VERIFY: npx tsc --noEmit passes. Load the unpacked build in a clean Chrome profile:
the install dialog must NOT say "all websites". First Capture click shows the Chrome
permission prompt. Declining leaves Add and Bulk fully functional.

Na kraju uradi git commit sa porukom: feat: optional host permission model for Chrome Web Store distribution
```

---

# T10 — Help, version bump, changelog

**Depends on:** all of T1–T9 and T11 · **Parallel:** no, run last

```
# Prompt T10 — Help content, version bump and changelog for v3.0.0
Model: mimo-v2.5

Final task for v3.0.0. Run only after T1 through T9 and T11 are merged and building cleanly.

1) VERSION BUMP
Set version to "3.0.0" in manifest.json and package.json.
Major bump: new capture context, new permission model, new description section,
new editor tool.

2) CHANGELOG.md — add at the top:

    ## 3.0.0 — Faza 6: Capture context and editor polish

    ### Added
    - Crop tool in the annotation editor — isolate a region from any screenshot,
      including files uploaded from disk
    - Capture details automatically merged into the description: page URL, title,
      timestamp, viewport size, zoom level, browser and OS
    - Screenshot numbering — attachments named 1.jpg, 2.jpg so you can reference them
      in the description
    - Separate Capture and Add buttons — take a screenshot or upload an existing file
    - Settings reorganized into collapsible sections with inline explanations
    - Transparent background fill option (white or black) for converted PNGs
    - Capture details can be placed at the start or end of the description

    ### Changed
    - All images are converted to JPEG on entry, keeping extension storage small
    - Screenshot preview and annotation merged into one window — open a screenshot,
      look at it, annotate it if you want, close it if you don't
    - Annotations and crops are always saved at maximum quality regardless of the
      ingest quality setting
    - Screenshots now live in a dedicated card with horizontal scrolling
    - Page access is now requested on first screenshot instead of at install time

    ### Removed
    - Thumbnail drag-to-reorder — Jira does not preserve attachment order
    - The separate Preview mode

3) HELP PANEL — src/sidepanel/Help.tsx
- Update the hardcoded changelog data to match CHANGELOG.md exactly.
- REMOVE the "Multiple screenshots per task — coming soon" card. That shipped in 2.0.0
  and is stale.
- Screenshot section, add "Image format":
      "Every image is converted to JPEG when it enters the extension and scaled to
      1920px wide. You don't need to prepare anything — drop in whatever you have.
      PNG files work fine, they just get converted. Quality and size are adjustable
      in Settings."
- Screenshot section, add "Cropping":
      "Click any screenshot to open it. Crop first if you only need part of the image,
      then annotate. Crop is disabled once you've drawn something — that protects your
      annotations from being cut away."
- Single task section, add "Capture details":
      "Screenshots taken with the extension add a short block to the description with
      the page URL, viewport size, zoom level and browser version — useful for bug
      reports where those conditions matter. It isn't typed into the description box;
      it's generated when the task is created, so it always matches what's attached.
      Uploaded files don't get this block. Turn it off in Settings if you don't need it."
- Single task section, update to describe the Capture and Add buttons.
- Quick setup section, add "Page access":
      "The first time you take a screenshot, Chrome asks for permission to read the
      current page. Uploading files works without it."

4) FINAL CHECKS
- npx tsc --noEmit — zero errors
- npm run build — clean build
- manifest.json permissions do NOT contain "scripting"
- manifest.json host_permissions contains ONLY the atlassian.net entry
- optional_host_permissions contains "<all_urls>"
- No references remain to PreviewMode, EditorMode, or any reorder handler

Na kraju uradi git commit sa porukom: feat: v3.0.0 help content, changelog and version bump
```

---

## Post-merge manual test checklist

Run after T10. These cover the interactions most likely to break across task boundaries.

**Capture and metadata**
- [ ] Capture on a normal page → number badge shows 1, details preview row appears
- [ ] Reported viewport roughly matches the visible page area (narrower than the full
      window by the side panel width — this is correct, not a bug)
- [ ] Set page zoom to 150% and capture → reported viewport width drops accordingly
- [ ] Capture on `chrome://extensions` → screenshot succeeds, no error
- [ ] Metadata position set to "top" → block appears above the user text

**Image handling**
- [ ] Drop a PNG with transparency → white background, no black edges
- [ ] Switch transparency fill to Black → next drop has black background
- [ ] Quality slider at 0.6 → visibly smaller files, editor output still sharp

**Numbering**
- [ ] Capture 3, delete #2, capture again → badges read 1, 3, 4
- [ ] Create task → counter resets, next capture is 1
- [ ] Bulk drop 3 files → `1 - x.jpg`, `2 - y.jpg`, `3 - z.jpg`
- [ ] Bulk remove middle row → remaining rows renumber to 1 and 2

**Screenshot card**
- [ ] Add 5 screenshots → horizontal scroll with right-edge fade
- [ ] Scroll to the end → fade disappears
- [ ] Reach 10 → both header buttons disabled, count turns red

**Editor**
- [ ] Open, close without drawing → no confirm dialog
- [ ] Open, draw, press Escape → confirm dialog appears
- [ ] Draw then undo to empty → button returns to Close
- [ ] Crop then annotate → works. Annotate then crop → disabled with tooltip
- [ ] Crop with the editor window smaller than the image → region is accurate
- [ ] Undo after crop → full image and original dimensions restored

**Permissions**
- [ ] Fresh profile install → dialog does NOT mention "all websites"
- [ ] First Capture click → Chrome permission prompt appears
- [ ] Decline → Add and the whole Bulk tab still work
- [ ] Grant from Settings row → status flips to Granted

**Tooltips**
- [ ] Tooltip near the top of the panel flips below instead of clipping
- [ ] Tooltip near either side edge stays inside the panel
- [ ] Tab to a tooltip trigger → bubble appears on focus

---

## Deferred to later versions

| Item | Version | Note |
|---|---|---|
| Annotating bulk-uploaded files | 3.1.0 | Requires generalizing `PendingEditor` from index-based to `{ context, id }` targeting |
| Zoom and pan in the editor | 3.1.0 | More relevant now that the editor is also the viewer |
| Exact viewport via `scripting` | — | Only if arithmetic derivation proves inaccurate in practice. Would need an optional permission and a fallback for restricted pages, so the current approach is preferred |
| Region capture overlay | 3.2.0 | Only if crop proves insufficient after real use. Needs a content script, devicePixelRatio math, and a fallback for restricted pages |

---

## Chrome Web Store submission notes (for later, not part of this pack)

Collected here so they are not rediscovered under time pressure:

- **Privacy policy is mandatory** for any extension that handles user data. The Jira API
  token qualifies. A short page stating that credentials stay in local browser storage,
  that there is no server, and that no telemetry is collected will satisfy this.
- **Single purpose policy** — the listing must describe one purpose. "Create Jira tasks
  from browser screenshots" is a clean single purpose. Do not describe it as a general
  screenshot tool.
- **Permission justification fields** — each permission needs a one-line reason in the
  developer dashboard. Prepare: `activeTab` and optional `<all_urls>` for capturing the
  visible tab; `storage` for settings and workflows; `tabs` for reading the URL and title
  of the captured page; `notifications` for bulk completion; `alarms` for keeping the
  service worker alive during bulk uploads; `sidePanel` for the UI.
- **Remote code is prohibited.** Confirm the Vite build inlines everything and loads no
  external scripts or fonts at runtime. The project already has a no-external-fonts rule,
  which helps here.
- **Screenshots and a listing description** are required. Take them at 1280x800.
