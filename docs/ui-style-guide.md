# Orchard Briefing UI guide

Status: working design direction, 2026-10-19.

## Purpose and voice

Plan work organizes clear orchard instructions. Today’s tasks shows the location, materials and finish condition, update status, or ask for help. The interface should feel like a well-kept field notebook: calm, direct, durable, and easy to scan outdoors. Write for the task, not for a marketing page. Use “Prepare a task,” “Today’s tasks,” and “Send help request” rather than slogans. English, Spanish and German should convey the same operational facts; do not auto-fill missing instructions.

## Visual system

- Keep warm off-white canvas and deep orchard green as the distinctive palette. Surfaces are flat and bright; borders do most of the grouping. Use shadows sparingly.
- DM Sans is the UI face. Libre Caslon Display is reserved for the main page heading and major section headings. Body text should be 15–16px, field labels and controls at least 13–14px, explanatory text at least 13px.
- Semantic tokens: `canvas`, `surface`, `ink`, `muted`, `line`, `primary`, `primary-foreground`, `focus`, `status-warning`, `status-success`. Define values in CSS and expose key colors via Tailwind `@theme`.
- Use an 8px spacing rhythm with compact 4px adjustments; cards use 16px radius, controls 8px. Main controls are at least 44px high.
- Lucide icons at 16–20px with 2px stroke. Keep text labels for actions. Decorative icons are hidden from assistive technology.
- Use one primary action per area. Secondary and quiet actions have clear visual hierarchy. Status color is always paired with words.
- On phone, one task per row; keep status and action visible without horizontal scroll. At 200% zoom, text should reflow without clipped controls.

## Component rules

Start from native HTML for form elements and disclosure. Use Tailwind utilities for new layout and token-backed custom work. Bring in shadcn/Base UI components when a complex interaction is needed, such as a dialog, select, tooltip or menu. Preserve existing working interaction patterns until a replacement is reviewed. Buttons share the `Button` component for consistent primary, secondary and quiet variants.

## Copy examples

| Need | Use |
| --- | --- |
| Planning heading | “Prepare today’s work” |
| Task-list heading | “Today’s tasks” / “Tareas de hoy” |
| Empty filter | “No tasks match this filter. Choose All tasks to see the full list.” |
| Failed save | “Couldn’t save the update. Refresh the list and try again.” |
| Audio action | “Create recording” / “Crear grabación” / “Aufnahme erstellen” |
