export type Species = 'Chestnut' | 'Walnut' | 'Heartnut' | 'Hazel';
export type BriefingTask = { species: Species; title: string; location?: string | null; materials_location?: string | null; done_when?: string | null; done: boolean };

export const SPECIES: Species[] = ['Chestnut', 'Walnut', 'Heartnut', 'Hazel'];

export function isSpecies(value: string): value is Species {
  return SPECIES.includes(value as Species);
}

export function cleanTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, ' ');
  if (title.length < 1 || title.length > 120) throw new Error('Use a task between 1 and 120 characters.');
  return title;
}

export function cleanOptionalField(value: unknown, limit: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('Invalid task details.');
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length > limit) throw new Error('Task detail is too long.');
  return clean || null;
}

export function makeBriefing(tasks: BriefingTask[]): string {
  const open = tasks.filter((task) => !task.done).slice(0, 8);
  if (open.length === 0) return 'Your orchard list is clear. Take a walk through the rows and enjoy the progress.';
  const intro = `Your orchard has ${open.length} open ${open.length === 1 ? 'task' : 'tasks'} in this briefing.`;
  const items = open.map((task, index) => {
    const location = task.location ? ` in ${task.location}` : '';
    const materials = task.materials_location ? ` Materials: ${task.materials_location.replace(/[.!?]+$/, '')}.` : '';
    const doneWhen = task.done_when ? ` Done when: ${task.done_when.replace(/[.!?]+$/, '')}.` : '';
    return `${index + 1}. ${task.species}: ${task.title.replace(/[.!?]+$/, '')}${location}.${materials}${doneWhen}`;
  });
  return `${intro} ${items.join(' ')} You can mark each task complete when you are back from the field.`;
}
