import type { Language } from './work-order';

const messages = {
  createRecording: {
    en: 'Create recordings in all languages',
    es: 'Crear grabaciones en todos los idiomas',
    de: 'Aufnahmen in allen Sprachen erstellen',
  },
  creatingRecording: {
    en: 'Preparing all three languages…',
    es: 'Preparando los tres idiomas…',
    de: 'Alle drei Sprachen werden vorbereitet…',
  },
  recordingLimit: {
    en: 'New recordings are unavailable right now. You can still listen to existing recordings.',
    es: 'No se pueden crear grabaciones ahora. Puedes escuchar las que ya están guardadas.',
    de: 'Neue Aufnahmen sind gerade nicht verfügbar. Vorhandene Aufnahmen kannst du weiter anhören.',
  },
  recordingTooLong: {
    en: 'These instructions are too long to record. Shorten them in Plan work and try again.',
    es: 'Las instrucciones son demasiado largas para grabarlas. Acórtalas en Planificar trabajo e inténtalo de nuevo.',
    de: 'Diese Anweisungen sind zu lang für eine Aufnahme. Kürze sie unter „Arbeit planen“ und versuche es erneut.',
  },
  recordingTranslations: {
    en: 'Add English, Spanish and German instructions in Plan work before creating recordings.',
    es: 'Añade las instrucciones en inglés, español y alemán en Planificar trabajo antes de crear las grabaciones.',
    de: 'Ergänze unter „Arbeit planen“ die Anweisungen auf Englisch, Spanisch und Deutsch, bevor du Aufnahmen erstellst.',
  },
  recordingFailed: {
    en: 'Couldn’t create this recording. Please try again later.',
    es: 'No se pudo crear la grabación. Inténtalo más tarde.',
    de: 'Die Aufnahme konnte nicht erstellt werden. Versuche es später erneut.',
  },
  recordingChanged: {
    en: 'The task changed or a recording is already being prepared. Refresh and try again.',
    es: 'La tarea cambió o la grabación ya se está preparando. Actualiza e inténtalo de nuevo.',
    de: 'Die Aufgabe wurde geändert oder die Aufnahme wird bereits erstellt. Aktualisiere und versuche es erneut.',
  },

  refresh: { en: 'Refresh', es: 'Actualizar', de: 'Aktualisieren' },
  statusUpdatedYourProgressIs: {
    en: 'Status updated. Your progress is visible in Plan work.',
    es: 'Estado actualizado. Tu progreso aparece en Planificar trabajo.',
    de: 'Status aktualisiert. Dein Fortschritt ist unter „Arbeit planen“ sichtbar.',
  },
  skipToTasks: {
    en: 'Skip to tasks',
    es: 'Ir a las tareas',
    de: 'Zu den Aufgaben',
  },
  orchardView: {
    en: 'Orchard view',
    es: 'Vista del huerto',
    de: 'Ansicht wählen',
  },
  planWork: {
    en: 'Plan work',
    es: 'Planificar trabajo',
    de: 'Arbeit planen',
  },
  todaySTasks: {
    en: 'Today’s tasks',
    es: 'Tareas de hoy',
    de: 'Heutige Aufgaben',
  },
  demoOrchard: {
    en: 'Demo orchard',
    es: 'Huerto de muestra',
    de: 'Beispielanlage',
  },
  instructionsLanguage: {
    en: 'Instructions language',
    es: 'Idioma de las instrucciones',
    de: 'Sprache der Anweisungen',
  },
  yourLanguage: {
    en: 'Your language',
    es: 'Tu idioma',
    de: 'Deine Sprache',
  },
  dismissNotice: {
    en: 'Dismiss notice',
    es: 'Cerrar aviso',
    de: 'Hinweis schließen',
  },
  loading: {
    en: 'Loading…',
    es: 'Cargando…',
    de: 'Wird geladen…',
  },
  filterTasks: {
    en: 'Filter tasks',
    es: 'Filtrar tareas',
    de: 'Aufgaben filtern',
  },
  publishedWorkIsSavedIn: {
    en: 'Published work is saved in your demo workspace.',
    es: 'Tus cambios se guardan al publicar.',
    de: 'Veröffentlichte Aufgaben werden in deinem Demo-Arbeitsbereich gespeichert.',
  },
  noTasksInThisView: {
    en: 'No tasks in this view.',
    es: 'No hay tareas en esta vista.',
    de: 'Keine Aufgaben in dieser Ansicht.',
  },
  fictionalDemoBothViewsShare: {
    en: 'Fictional demo. Both views share this browser’s workspace; they are not separate accounts.',
    es: 'Demo con tareas ficticias. Ambas vistas comparten la lista de este navegador; no son cuentas separadas.',
    de: 'Fiktive Demo. Beide Ansichten teilen den Arbeitsbereich dieses Browsers; es sind keine getrennten Konten.',
  },
  where: {
    en: 'Where',
    es: 'Dónde',
    de: 'Ort',
  },
  askTheTeam: {
    en: 'Ask the team',
    es: 'Consultar al equipo',
    de: 'Im Team nachfragen',
  },
  materials: {
    en: 'Materials',
    es: 'Materiales',
    de: 'Material',
  },
  notSpecified: {
    en: 'Not specified',
    es: 'Sin especificar',
    de: 'Nicht angegeben',
  },
  finishedWhen: {
    en: 'Finished when',
    es: 'Se termina cuando',
    de: 'Erledigt, wenn',
  },
  crewNote: {
    en: 'Crew note',
    es: 'Nota del equipo',
    de: 'Notiz aus dem Team',
  },
  listenToInstructions: {
    en: 'Listen to instructions',
    es: 'Escuchar instrucciones',
    de: 'Anweisungen anhören',
  },
  recordedInstructions: {
    en: 'Recorded instructions',
    es: 'Instrucciones grabadas',
    de: 'Aufgezeichnete Anweisungen',
  },
  reopenTask: {
    en: 'Reopen task',
    es: 'Reabrir tarea',
    de: 'Aufgabe wieder öffnen',
  },
  startTask: {
    en: 'Start task',
    es: 'Empezar',
    de: 'Aufgabe beginnen',
  },
  markDone: {
    en: 'Mark done',
    es: 'Marcar terminada',
    de: 'Als erledigt markieren',
  },
  needHelp: {
    en: 'Need help',
    es: 'Necesito ayuda',
    de: 'Hilfe benötigt',
  },
  whatDoYouNeedTo: {
    en: 'What do you need to continue?',
    es: '¿Qué necesitas para seguir?',
    de: 'Was brauchst du, um weiterzumachen?',
  },
  sendHelpRequest: {
    en: 'Send help request',
    es: 'Pedir ayuda',
    de: 'Hilfe anfragen',
  },
  cancel: {
    en: 'Cancel',
    es: 'Cancelar',
    de: 'Abbrechen',
  },
  tasksHeading: {
    en: 'Today’s tasks.',
    es: 'Tareas de hoy.',
    de: 'Heutige Aufgaben.',
  },
  tasksEyebrow: {
    en: 'TASKS',
    es: 'TAREAS',
    de: 'AUFGABEN',
  },
  taskIntro: {
    en: 'Check where to go, what to bring, and when the task is done. Send a note if you need help.',
    es: 'Consulta dónde ir, qué llevar y cuándo está terminado. Avisa si necesitas ayuda.',
    de: 'Sieh nach, wo du arbeiten sollst, was du brauchst und wann die Aufgabe erledigt ist. Melde dich, wenn du Hilfe brauchst.',
  },
  workList: {
    en: 'Work list',
    es: 'Lista de trabajo',
    de: 'Aufgabenliste',
  },
  gettingTasks: {
    en: 'Getting the work list…',
    es: 'Cargando el trabajo…',
    de: 'Aufgaben werden geladen…',
  },
  loadFailed: {
    en: 'The work list could not be loaded. Try Refresh.',
    es: 'No se pudo cargar la lista. Pulsa Actualizar.',
    de: 'Die Aufgaben konnten nicht geladen werden. Bitte aktualisieren.',
  },
  saveFailed: {
    en: 'Could not save. Refresh the list and try again.',
    es: 'No se pudo guardar. Actualiza la lista e inténtalo de nuevo.',
    de: 'Speichern fehlgeschlagen. Aktualisiere die Liste und versuche es erneut.',
  },
  emptyHint: {
    en: 'Choose All tasks to see the whole list. Ask the team if something is missing.',
    es: 'Selecciona Todas para ver la lista completa. Consulta al equipo si falta algo.',
    de: 'Wähle Alle Aufgaben, um die gesamte Liste zu sehen. Frage im Team nach, wenn etwas fehlt.',
  },
  voiceCredit: {
    en: 'Voice powered by ElevenLabs',
    es: 'Voz con ElevenLabs',
    de: 'Stimme von ElevenLabs',
  },
  translationMissing: {
    en: 'Instructions are not available in this language. Ask the team before starting.',
    es: 'Las instrucciones en español aún no están listas. Consulta al equipo antes de empezar.',
    de: 'Die deutschen Anweisungen sind noch nicht verfügbar. Frage vor Arbeitsbeginn im Team nach.',
  },
  showEnglish: {
    en: 'Show English original',
    es: 'Ver original en inglés',
    de: 'Englisches Original anzeigen',
  },
} as const;

export function uiCopy(language: Language) {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [key, value[language]]),
  ) as { [K in keyof typeof messages]: string };
}
