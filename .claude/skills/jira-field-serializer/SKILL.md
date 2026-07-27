---
name: jira-field-serializer
description: Use when adding support for a new Jira custom field type, or reviewing existing field-serialization code, in src/lib/jira.ts.
---

# Adding a Jira field type to serializeField

`serializeField` (`src/lib/jira.ts:94`) is a type-aware switch keyed on `field.schema.type`, called from the create-issue path at `src/lib/jira.ts:281`. It converts a plain string form value into the shape Jira's REST API v3 expects for that field type. Getting this wrong doesn't fail at compile time — it fails as a 400 from Jira at issue-creation time.

## Existing branches (the pattern to match)

```ts
switch (field.schema?.type) {
  case 'option':   return { value };
  case 'priority': return { name: value };
  case 'user':     return { accountId: value };
  case 'array':
    if (field.schema?.items === 'option') return [{ value }];
    if (field.schema?.items === 'string') return [value];
    return [value];
  case 'number':   return Number(value);
  default:         return value;   // falls through as plain string
}
```

## Steps to add a new type

1. **Find the real schema shape first.** Don't guess the Jira wire format — inspect the cached createmeta response for the field in question: `chrome.storage.local` key `jirawm_createmeta_{projectKey}`. Look at `schema.type` and `schema.custom` (the custom field type URI, e.g. `com.atlassian.jira.plugin.system.customfieldtypes:...`) to know exactly which branch should match and what shape Jira wants back.
2. **Add a branch to the switch**, following the existing style — one line per case, matching on `field.schema.type` (and `field.schema.items` if it's an array-of-something).
3. **Never let a description-type field fall through as a plain string.** Descriptions must go through the `toADF` helper (`src/lib/jira.ts` — see `toADF`/`buildDescriptionADF` near line 80), not through `serializeField`. If the new field type is a rich-text/description-like field, route it through ADF, not this switch.
4. **Don't bypass the createmeta cache.** The cache exists specifically so the form doesn't refetch createmeta on every open (see project rule in `CLAUDE.md`: "Cache createmeta response ... never fetch on every form open"). If testing the new field type requires fresher metadata, clear the specific `jirawm_createmeta_{projectKey}` key rather than removing the cache check.
5. **Check the call site** (`src/lib/jira.ts:281`) still passes `params.fieldMeta` for the new field the same way it does for existing ones — no special-casing the call site itself.

## Before declaring done

This complements, but doesn't replace, the `code-reviewer` agent's serialization check ("Custom field values must go through the type-aware `serializeField` helper... flag any new field-writing code that stringifies these types manually"). Run that review on the diff before considering the new field type done.
