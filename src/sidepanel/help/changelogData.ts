export type ChangelogRelease = {
  version: string;
  date: string;
  items: string[];
  major?: boolean;
};

export const CHANGELOG_DATA: ChangelogRelease[] = [
  {
    version: '3.4.14',
    date: 'Avgust 2026',
    items: [
      'Screenshot shortcode chip in the Comment tab moved from a separate row below the screenshot strip to directly under its matching thumbnail',
      'Chip label truncated to 12 characters with an ellipsis for long tokens, with the full token shown as a tooltip on hover',
    ],
  },
  {
    version: '3.4.0',
    date: 'Juli 2026',
    items: [
      'Automatic check for new GitHub releases — compares the installed extension version against the latest tagged release and looks for a .zip release asset',
      'Background service worker checks for updates once on startup and then every 6 hours via a scheduled alarm',
      'Dismissible update banner at the bottom of the side panel with a "Download" link to the latest release; dismissing it remembers that version so the banner won\'t reappear until a newer one is available',
      'Persistent update indicator at the bottom of the Help panel that always shows when an update is available, independent of whether the global banner was dismissed',
    ],
  },
  {
    version: '3.3.0',
    date: 'Juli 2026',
    items: [
      'Comment tab — post a comment to an existing Jira task without creating a new issue',
      'Project + issue picker with fuzzy search by key or summary',
      'Screenshot capture in the Comment tab reuses the Task capture/annotate/thumbnail flow',
      'Each screenshot gets a shortcode token matching its real attachment filename (e.g. "[1-filename.jpg]"), shown as a clickable chip that inserts the token at the cursor position in the comment text',
      'Left in the comment text, a token is also a clickable link to a 1400x1400 thumbnail preview of that screenshot (not the full-resolution original)',
      'Screenshots not referenced by a token still attach normally to the issue, just without a link in the comment text — there is no automatic append-to-end behavior',
      'After posting, a success view shows a link to view the comment directly on the issue, plus "New comment on {issue}" (keeps the same issue, clears the form) and "New comment" (full reset) buttons',
      'Bulk tab label shortened from "Bulk Upload" to "Bulk" in the tab bar',
      'Help panel documentation updated to consistently say "Task" and "Bulk" instead of "Single Task" and "Bulk Upload", matching the already-renamed tab labels',
      'Fixed: tab content panes (Task, Bulk, Workflows, Help) no longer collapse to content height — they now fill the available panel height',
    ],
  },
  {
    version: '3.2.0',
    date: 'Juli 2026',
    items: [
      'Workflow setup now blocks selecting a sub-task as a parent — Jira does not allow subtasks of subtasks',
      'Required and optional workflow fields with predefined Jira values now show a dropdown instead of free text',
      'Bulk upload shows clear green Success / red Error status labels',
      'Bulk upload header shows an animated progress indicator while an upload is running',
      'Start Upload shows a spinner and "Uploading…" while processing, and can no longer be double-clicked',
      'Bulk upload footer (Clear All / Start Upload) stays pinned to the bottom of the panel',
      'Clear All now asks for confirmation if any rows have not finished successfully',
      'Completed rows are automatically cleared from the list once new screenshots are added',
      'Save Workflow shows a spinner and is disabled while saving, preventing duplicate submissions',
      'Create Task shows a spinner while submitting',
      'Native select dropdowns now highlight the option under the cursor on hover',
      'Jira API errors now show a readable message instead of raw JSON',
      'Create Task and Save Workflow buttons are now green to stand out as the primary action',
      'Workflow breadcrumb now uses → separators',
    ],
  },
  {
    version: '3.1.2',
    date: 'Juli 2026',
    items: [
      'Retry Failed no longer creates a duplicate Jira issue when attachment previously failed — worker resumes from uploading state using the existing issueKey.',
      'Bulk upload filename numbering no longer accumulates prefixes when adding or removing rows',
      'Annotation editor handoff is now race-safe: Side Panel owns annotationResult cleanup after applying/safely discarding the result',
      'Bulk upload start/retry now handles worker start errors and avoids stuck processing state by stopping polling and showing a clear error',
    ],
  },
  {
    version: '3.1.1',
    date: 'Juli 2026',
    items: [
      'Crop tool toolbar button now reliably enters crop mode',
      'Crop overlay now darkens the area outside the selection, not the selection itself',
      'Crop Apply no longer produces a blank canvas',
      'Crop mode opens empty — draw your own selection zone instead of starting from a pre-filled default',
      'Selection can be moved and resized by dragging its body or handles',
      'Save no longer shows a false "unsaved changes" prompt when you save intentionally',
      'Marker labels now use the correct system font',
    ],
  },
  {
    version: '3.1.0',
    date: 'Juli 2026',
    items: [
      'Capture details can now be corrected or hidden per screenshot, from a panel beside the annotation canvas',
      'The editor now shows Save when something changed and Close when nothing did',
      'Edited screenshots are marked with a badge in the side panel',
      'New Settings option controls whether per-screenshot editing is available',
    ],
  },
  {
    version: '3.0.1',
    date: 'Juli 2026',
    items: [
      'Screenshots captured losslessly; only one JPEG compression pass via ingest pipeline',
      'Timestamp option in Settings now controls the description block',
      'Multi-file Add enforces the 10 screenshot limit and reports skipped files',
      'Annotations target screenshots by stable id instead of array index',
      'Capture details preview matches the block sent to Jira',
      'Permission prompt now always fires on first Capture click',
    ],
  },
  {
    version: '3.0.0',
    date: 'Juli 2026',
    major: true,
    items: [
      'Crop tool inside the annotation editor',
      'Capture details block added to task descriptions from screenshot metadata',
      'Permission-free viewport derivation — no page access needed until first screenshot',
      'Screenshots now live in a dedicated card with horizontal scrolling',
      'Page access is now requested on first screenshot instead of at install time',
    ],
  },
  {
    version: '2.1.0',
    date: 'Juli 2026',
    items: [
      'Lista projekata prikazuje samo aktivne projekte, sortirana abecedno',
      'Pretraga parent taska prepisana — direktan lookup po key-u, wildcard JQL, svi izvori uvek upitani sa izolacijom grešaka',
      'Uklonjen client-side filter koji je odbacivao validne server rezultate',
      'Migracija sa deprecated GET /search na POST /search/jql',
      'Assignee dropdown sada učitava korisnike odmah po izboru projekta',
      'Save dugme vraćeno i uvek vidljivo u formi za workflow',
      'Polje za ime workflowa premješteno na vrh forme',
      'Issue type pozicioniran iznad default assignee',
      'Pretraživi assignee combobox zamjenjuje dugu native listu',
      'Inline "Connect to Jira" link u empty state-u vodi direktno na Settings',
    ],
  },
  {
    version: '2.0.0',
    date: 'Juli 2026',
    items: [
      'Annotation editor — popup prozor sa Fabric.js canvas editorom',
      'Alati: strelica, kvadrat (outline/fill), numbered markers, tekst',
      'Screenshot preview popup pre anotacije',
      '5 preset boja, stroke width, undo/redo, keyboard shortcuts',
      'Popup pamti dimenzije i poziciju između sesija',
    ],
    major: true,
  },
  {
    version: '1.4.0',
    date: 'Juli 2026',
    items: [
      'Assignee dropdown u Single i Bulk modu',
      'Help panel sa 6 sekcija',
    ],
  },
  {
    version: '1.3.0',
    date: 'Juli 2026',
    items: [
      'Thumbnail strip — više screenshotova po tasku (max 10)',
      'Drag & drop reorder, lightbox navigacija',
      'Sekvencijalni upload više attachmenta',
    ],
  },
  {
    version: '1.2.0',
    date: 'Juli 2026',
    items: [
      'Export/import workflowa kao JSON',
      'Snapshot metadata u Settings-u',
    ],
  },
  {
    version: '1.1.0',
    date: 'Juli 2026',
    items: [
      'Bulk mod sa background Service Worker processingom',
      'Per-row status, progress persistencija, retry failed',
      'Desktop notifikacija po završetku',
    ],
  },
  {
    version: '1.0.0',
    date: 'Juli 2026',
    items: [
      'Inicijalno izdanje — Single Task, Settings, Workflow CRUD',
      'Screenshot capture, JPEG kompresija, Jira API integracija',
    ],
  },
];
