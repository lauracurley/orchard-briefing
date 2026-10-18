import { cleanOptionalField, cleanTitle, isSpecies, type Species } from './briefing';

export type TaskDraft = { species: Species | ''; title: string; location: string; doneWhen: string };

export function parseAgentDraft(value: unknown): TaskDraft {
  if (!value || typeof value !== 'object') throw new Error('The suggested task needs an action.');
  const fields = value as Record<string, unknown>;
  if (typeof fields.title !== 'string') throw new Error('The suggested task needs an action.');
  return {
    species: typeof fields.species === 'string' && isSpecies(fields.species) ? fields.species : '',
    title: cleanTitle(fields.title),
    location: cleanOptionalField(fields.location, 60) ?? '',
    doneWhen: cleanOptionalField(fields.doneWhen, 120) ?? '',
  };
}
