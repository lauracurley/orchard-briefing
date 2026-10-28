# Product design: multilingual work handoff

## One complete story

In Plan work, prepare a task, review English and optional Spanish and German instructions, and publish. In Today’s tasks, see where to go, what materials to bring and what finished means, then start, finish or report a problem. Progress appears in both views.

The text workflow requires no provider calls. An explicit Create recordings in all languages action prepares English, Spanish and German speech together within a small shared budget. Existing recordings are reused. Prepared examples are labeled as examples. Custom notes require manual review and translation. Voice recording controls remain absent until the supported capture integration is ready.

## Design references

These are pattern references, not templates or copied assets:

- [Connecteam task management](https://connecteam.com/task-management-app/): separate assigning work from completing work, keep instructions and progress together.
- [Linear interface design](https://linear.app/now/behind-the-latest-design-refresh): clear hierarchy, restrained navigation, predictable spacing and focused task actions.

Orchard Briefing adapts those ideas for field use: warm cream/green colors, large touch targets, readable task details, multilingual task controls, and explicit materials locations. Serif display headings establish identity; the operational interface uses a readable sans serif. Decorative hero artwork is removed from the workspace.

## Data and behavior decisions

- English and any included Spanish and German instructions are reviewed together and published atomically. Missing translations are shown explicitly; English is never silently presented as translated text.
- Physical labels such as North Shed remain recognizable in translations.
- Changing any language resets the review checkbox. A new publication replaces the translated content together with the English instructions.
- Task status: ready, in progress, needs help, done. Requesting help requires a note. Resolving the status clears the active blocker; a full activity history is out of scope.
- Published data lives in PostgreSQL. Unpublished drafts are scoped to the workspace in localStorage. One draft per browser workspace keeps the demo small.
- Revision checks protect against stale writes. Both activity views share the same data; view switching is a demo affordance, not authorization.
- Task audio is loaded only for the exact approved content and language. Cache misses do not synthesize speech. Historical whole-list recordings are not attached to individual tasks.

## Acceptance criteria

1. The planning/doing distinction is understandable from the first screen.
2. A fictional task can be reviewed, published, started and completed in Spanish and German without a paid request.
3. Materials locations are visible in all included languages; no missing facts are invented.
4. Unsaved draft text survives a refresh when storage is available.
5. Failed saves preserve the draft and display a useful message.
6. English edits require renewed review before publication.
7. A help request appears in Plan work.
8. Desktop and phone layouts fit the viewport and all primary controls are keyboard-accessible.
9. Only explicit task recordings can call a provider, within the shared daily and monthly budget. Cached replay remains available after the allowance is exhausted.

## Deliberate boundaries

No native app, real crew accounts, cross-device sharing, maps, weather, agronomy advice, offline sync or live voice chat in this iteration. A production handoff needs authenticated workspace membership and role authorization before private operational use.

Task recordings are generated once per exact approved text, language and voice. Daily limits and monthly limits are enforced in PostgreSQL. Translation precedes synthesis; text-to-speech does not translate. Scribe capture and an optional clarification agent come after the core handoff is validated.
