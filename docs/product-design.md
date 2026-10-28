# Product design: bilingual work handoff

## One complete story

A manager prepares a task, reviews English and Spanish instructions, and publishes. A worker sees where to go, what materials to bring and what finished means, then starts, finishes or reports a problem. The manager sees that update.

The initial preview exercises this story without provider calls. Prepared examples are labeled as examples. Custom notes require manual review and translation. Voice recording controls remain absent until the supported capture integration is ready.

## Design references

These are pattern references, not templates or copied assets:

- [Connecteam task management](https://connecteam.com/task-management-app/): separate assigning work from completing work, keep instructions and progress together.
- [Linear interface design](https://linear.app/now/behind-the-latest-design-refresh): clear hierarchy, restrained navigation, predictable spacing and focused task actions.

Orchard Briefing adapts those ideas for field use: warm cream/green colors, large touch targets, readable task details, bilingual worker controls, and explicit materials locations. Serif display headings establish identity; the operational interface uses a readable sans serif. Decorative hero artwork is removed from the workspace.

## Data and behavior decisions

- English and Spanish are reviewed together and published atomically. Missing Spanish is shown explicitly; the worker is never shown English under a Spanish label.
- Physical labels such as North Shed remain recognizable in translations.
- Changing either language resets the review checkbox. A new publication replaces the translated content together with the English instructions.
- Task status: ready, in progress, needs help, done. Requesting help requires a note. Resolving the status clears the active blocker; a full activity history is out of scope.
- Published data lives in PostgreSQL. Unpublished drafts are scoped to the workspace in localStorage. One draft per browser workspace keeps the demo small.
- Revision checks protect against stale writes. Both role views share the same data; role switching is a demo affordance, not authorization.
- Task audio is loaded only for the exact approved content and language. Cache misses do not synthesize speech. Historical whole-list recordings are not attached to individual tasks.

## Acceptance criteria

1. The manager/worker purpose is understandable from the first screen.
2. A fictional task can be reviewed, published, started and completed in Spanish without a paid request.
3. Materials locations are visible in both languages; no missing facts are invented.
4. Unsaved draft text survives a refresh when storage is available.
5. Failed saves preserve the draft and display a useful message.
6. English edits require renewed review before publication.
7. A worker's problem note appears in Management.
8. Desktop and phone layouts fit the viewport and all primary controls are keyboard-accessible.
9. Live provider calls stay blocked until a separately approved integration release.

## Deliberate boundaries

No native app, real crew accounts, cross-device sharing, maps, weather, agronomy advice, offline sync or live voice chat in this iteration. A production handoff needs authenticated workspace membership and role authorization before private operational use.

The next voice release should generate approved English/Spanish recordings once per task version. Translation precedes synthesis; text-to-speech does not translate. Scribe capture and an optional clarification agent come after the core handoff is validated.
