import { cleanOptionalField, cleanTitle, isSpecies, type Species } from './briefing';

export type Language = 'en' | 'es' | 'de';
export type WorkStatus = 'ready' | 'doing' | 'blocked' | 'done';
export type Instructions = {
  title: string;
  location: string;
  materialsLocation: string;
  doneWhen: string;
};
export type WorkTask = Instructions & {
  id: string;
  species: Species;
  spanish: Instructions | null;
  german?: Instructions | null;
  status: WorkStatus;
  helpNote: string;
  revision: number;
  done: boolean;
};
export type WorkDraft = {
  species: Species;
  english: Instructions;
  spanish: Instructions;
  german: Instructions;
  includeGerman: boolean;
  includeSpanish: boolean;
  note: string;
  taskId?: string;
  revision?: number;
};
export const emptyInstructions = (): Instructions => ({
  title: '',
  location: '',
  materialsLocation: '',
  doneWhen: '',
});
export const emptyDraft = (): WorkDraft => ({
  species: 'Chestnut',
  english: emptyInstructions(),
  spanish: emptyInstructions(),
  german: emptyInstructions(),
  includeGerman: false,
  includeSpanish: false,
  note: '',
});
export const STATUS_LABELS = {
  en: { ready: 'Ready', doing: 'In progress', blocked: 'Needs help', done: 'Done' },
  es: { ready: 'Pendiente', doing: 'En curso', blocked: 'Necesita ayuda', done: 'Terminada' },
  de: { ready: 'Bereit', doing: 'In Arbeit', blocked: 'Hilfe benötigt', done: 'Erledigt' },
};
export const SPECIES_LABELS = {
  Chestnut: 'Castaño',
  Walnut: 'Nogal',
  Heartnut: 'Nogal japonés',
  Hazel: 'Avellano',
};

export function cleanInstructions(value: Instructions): Instructions {
  if (!value || typeof value.title !== 'string') throw new Error('Add a clear action.');
  return {
    title: cleanTitle(value.title),
    location: cleanOptionalField(value.location, 60) ?? '',
    materialsLocation: cleanOptionalField(value.materialsLocation, 160) ?? '',
    doneWhen: cleanOptionalField(value.doneWhen, 120) ?? '',
  };
}
export function validateWorkInput(input: {
  species: string;
  english: Instructions;
  spanish?: Instructions | null;
  german?: Instructions | null;
}) {
  if (!isSpecies(input.species)) throw new Error('Choose a tree.');
  const english = cleanInstructions(input.english);
  const spanish = input.spanish ? cleanInstructions(input.spanish) : null;
  if (!english.location || !english.doneWhen)
    throw new Error('Add the work location and what counts as finished.');
  if (
    spanish &&
    (!spanish.location ||
      !spanish.doneWhen ||
      (english.materialsLocation && !spanish.materialsLocation))
  )
    throw new Error('Complete the Spanish instructions before publishing both languages.');
  const german = input.german ? cleanInstructions(input.german) : null;
  if (
    german &&
    (!german.location ||
      !german.doneWhen ||
      (english.materialsLocation && !german.materialsLocation))
  )
    throw new Error('Complete the German instructions before publishing.');
  return { species: input.species, english, spanish, german };
}
export function validateStatus(status: string, helpNote?: string | null) {
  if (!['ready', 'doing', 'blocked', 'done'].includes(status))
    throw new Error('Invalid work status.');
  const note = cleanOptionalField(helpNote, 240) ?? '';
  if (status === 'blocked' && !note) throw new Error('Tell the team what help you need.');
  return { status: status as WorkStatus, helpNote: status === 'blocked' ? note : '' };
}
export function instructionsFor(task: WorkTask, language: Language): Instructions | null {
  return language === 'de' ? (task.german ?? null) : language === 'es' ? task.spanish : task;
}
export function spokenTask(task: WorkTask, language: Language): string | null {
  const details = instructionsFor(task, language);
  if (!details) return null;
  return [details.title, details.location, details.materialsLocation, details.doneWhen]
    .filter(Boolean)
    .join('. ');
}

// Hand-authored fictional examples. These are fixtures, never presented as live translation.
export const EXAMPLES: WorkDraft[] = [
  {
    species: 'Chestnut',
    note: 'Check the chestnut guards along the east fence. Spare stakes and ties are in the north shed. Flag anything you cannot fix.',
    includeGerman: true,
    german: {
      title: 'Die Baumschutzhüllen der Esskastanien prüfen',
      location: 'Ostzaun (East fence)',
      materialsLocation: 'Ersatzpfähle und Bindematerial: North Shed',
      doneWhen: 'Alle Schutzhüllen geprüft; ungelöste Schäden gemeldet.',
    },
    includeSpanish: true,
    english: {
      title: 'Check the chestnut tree guards',
      location: 'East fence',
      materialsLocation: 'Spare stakes and ties: North Shed',
      doneWhen: 'Every guard checked; any unresolved damage reported.',
    },
    spanish: {
      title: 'Revisar los protectores de los castaños',
      location: 'Cerca este (East fence)',
      materialsLocation: 'Estacas y ataduras de repuesto: North Shed',
      doneWhen: 'Todos los protectores revisados; daños pendientes comunicados.',
    },
  },
  {
    species: 'Hazel',
    note: 'Walk hazel rows 1–3 and note any damaged guards. Use the notebook in the tool shed. Report the row numbers that need attention.',
    includeGerman: true,
    german: {
      title: 'Beschädigte Schutzhüllen in den Haselnussreihen erfassen',
      location: 'Haselnussreihen 1–3',
      materialsLocation: 'Notizbuch und Bleistift: Tool Shed',
      doneWhen: 'Reihen 1–3 geprüft und betroffene Reihennummern notiert.',
    },
    includeSpanish: true,
    english: {
      title: 'Record damaged guards in the hazel rows',
      location: 'Hazel rows 1–3',
      materialsLocation: 'Notebook and pencil: Tool Shed',
      doneWhen: 'Rows 1–3 checked and affected row numbers recorded.',
    },
    spanish: {
      title: 'Anotar los protectores dañados de los avellanos',
      location: 'Filas de avellanos 1–3',
      materialsLocation: 'Cuaderno y lápiz: Tool Shed',
      doneWhen: 'Filas 1–3 revisadas y números de las filas afectadas anotados.',
    },
  },
  {
    species: 'Walnut',
    note: 'Take a photo of the marked walnut tree in row 4 for the season log. The camera is in the office. Include the tree label in the photo.',
    includeGerman: true,
    german: {
      title: 'Den markierten Walnussbaum fotografieren',
      location: 'Walnussreihe 4',
      materialsLocation: 'Kamera: Office',
      doneWhen: 'Ein scharfes Foto aufgenommen, auf dem das Baumetikett lesbar ist.',
    },
    includeSpanish: true,
    english: {
      title: 'Photograph the marked walnut tree',
      location: 'Walnut row 4',
      materialsLocation: 'Camera: Office',
      doneWhen: 'One clear photo taken, with the tree label visible.',
    },
    spanish: {
      title: 'Fotografiar el nogal marcado',
      location: 'Fila de nogales 4',
      materialsLocation: 'Cámara: Office',
      doneWhen: 'Una foto nítida tomada, con la etiqueta del árbol visible.',
    },
  },
];
