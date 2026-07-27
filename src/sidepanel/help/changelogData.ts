export type ChangelogRelease = {
  version: string;
  date: string;
  items: string[];
  major?: boolean;
};

export const CHANGELOG_DATA: ChangelogRelease[] = [
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
