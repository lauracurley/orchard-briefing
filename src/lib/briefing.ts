export type Species = 'Chestnut' | 'Walnut' | 'Heartnut' | 'Hazel';
export type BriefingTask = { species: Species; title: string; done: boolean };

export const SPECIES: Species[] = ['Chestnut', 'Walnut', 'Heartnut', 'Hazel'];

export function isSpecies(value: string): value is Species {
  return SPECIES.includes(value as Species);
}

export function cleanTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, ' ');
  if (title.length < 1 || title.length > 120) throw new Error('Use a task between 1 and 120 characters.');
  return title;
}

export function makeBriefing(tasks: BriefingTask[]): string {
  const open = tasks.filter((task) => !task.done).slice(0, 8);
  if (open.length === 0) return 'Your orchard list is clear. Take a walk through the rows and enjoy the progress.';
  const intro = `Your orchard has ${open.length} open ${open.length === 1 ? 'task' : 'tasks'} in this briefing.`;
  const items = open.map((task, index) => `${index + 1}. ${task.species}: ${task.title.replace(/[.!?]+$/, '')}.`);
  return `${intro} ${items.join(' ')} You can mark each task complete when you are back from the field.`;
}
