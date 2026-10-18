'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyDraft,
  EXAMPLES,
  type Language,
  type WorkDraft,
  type WorkStatus,
  type WorkTask,
} from '@/lib/work-order';
import { loadTasks, query, TASK_FIELDS } from '@/lib/work-api';
import TaskEditor from './TaskEditor';
import TaskCard from './TaskCard';
import SavedRecordings from './SavedRecordings';

type View = 'management' | 'worker';
type Filter = 'all' | 'ready' | 'doing' | 'blocked' | 'done';
const FILTERS = {
  en: {
    all: 'All tasks',
    ready: 'Ready',
    doing: 'In progress',
    blocked: 'Needs help',
    done: 'Done',
  },
  es: {
    all: 'Todas',
    ready: 'Pendientes',
    doing: 'En curso',
    blocked: 'Necesitan ayuda',
    done: 'Terminadas',
  },
};
function hasDraft(draft: WorkDraft) {
  return !!(draft.note || draft.english.title || draft.taskId);
}

export default function OrchardApp() {
  const [orchardId, setOrchardId] = useState('');
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [view, setView] = useState<View>('management');
  const [language, setLanguage] = useState<Language>('en');
  const [filter, setFilter] = useState<Filter>('all');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<WorkDraft>(emptyDraft);
  const [editor, setEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const lastRequest = useRef(0);
  const manager = view === 'management';
  const lang: Language = manager ? 'en' : language;
  const es = lang === 'es';

  const refresh = useCallback(async (id: string, initialize = false) => {
    const request = ++lastRequest.current;
    setLoading(true);
    try {
      const data = await loadTasks(id, initialize);
      if (request === lastRequest.current) {
        setTasks(data);
        setError('');
        setReady(true);
      }
    } catch {
      if (request === lastRequest.current)
        setError('Could not load the work list. Your saved draft is safe. Please try Refresh.');
    } finally {
      if (request === lastRequest.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let id = crypto.randomUUID() as string;
    try {
      const saved = localStorage.getItem('orchard-briefing-id');
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) id = saved;
      localStorage.setItem('orchard-briefing-id', id);
      const raw = localStorage.getItem('orchard-work-draft:' + id);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.english && parsed.spanish && typeof parsed.note === 'string') setDraft(parsed);
      }
      if (localStorage.getItem('orchard-language') === 'es') setLanguage('es');
    } catch {
      setNotice('Browser storage is unavailable. Keep this page open to retain your draft.');
    }
    setOrchardId(id);
    setStorageReady(true);
    function syncView() {
      setView(window.location.hash === '#worker' ? 'worker' : 'management');
      setFilter('all');
    }
    syncView();
    window.addEventListener('hashchange', syncView);
    void refresh(id, true);
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('orchard-work:' + id);
      channel.current.onmessage = () => {
        void refresh(id);
      };
    }
    const onFocus = () => {
      void refresh(id);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('hashchange', syncView);
      window.removeEventListener('focus', onFocus);
      channel.current?.close();
    };
  }, [refresh]);
  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem('orchard-work-draft:' + orchardId, JSON.stringify(draft));
    } catch {
      setNotice('Draft could not be saved on this device. Keep this page open until you publish.');
    }
  }, [draft, orchardId, storageReady]);
  function chooseView(next: View) {
    setNotice('');
    window.location.hash = next;
    setView(next);
    setFilter('all');
    if (orchardId) void refresh(orchardId);
  }
  function chooseLanguage(next: Language) {
    setNotice('');
    setLanguage(next);
    try {
      localStorage.setItem('orchard-language', next);
    } catch {
      /* Selection still works for this visit. */
    }
  }
  function openEditor(next?: WorkDraft) {
    if (next && hasDraft(draft)) {
      setNotice('You have a saved draft. Publish or discard it before starting another.');
      setEditor(true);
    } else {
      if (next) setDraft(next);
      setEditor(true);
    }
    setEditError('');
    requestAnimationFrame(() =>
      document
        .getElementById('task-editor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
  function edit(task: WorkTask) {
    openEditor({
      taskId: task.id,
      revision: task.revision,
      species: task.species,
      english: {
        title: task.title,
        location: task.location ?? '',
        materialsLocation: task.materialsLocation ?? '',
        doneWhen: task.doneWhen ?? '',
      },
      spanish: task.spanish ?? emptyDraft().spanish,
      bilingual: !!task.spanish,
      note: '',
    });
  }
  function applyTask(task: WorkTask) {
    ++lastRequest.current;
    setLoading(false);
    setTasks((previous) =>
      previous.some((item) => item.id === task.id)
        ? previous.map((item) => (item.id === task.id ? task : item))
        : [task, ...previous],
    );
    channel.current?.postMessage('updated');
  }
  async function publish() {
    setSaving(true);
    setEditError('');
    try {
      const data = await query<{ saveTask: WorkTask }>(
        'mutation Save($orchardId: ID!, $taskId: ID, $revision: Int, $input: WorkInput!) { saveTask(orchardId: $orchardId, taskId: $taskId, revision: $revision, input: $input) { ' +
          TASK_FIELDS +
          ' } }',
        {
          orchardId,
          taskId: draft.taskId,
          revision: draft.revision,
          input: {
            species: draft.species,
            english: draft.english,
            spanish: draft.bilingual ? draft.spanish : null,
          },
        },
      );
      applyTask(data.saveTask);
      setDraft(emptyDraft());
      setEditor(false);
      setFilter('all');
      setNotice('Published. The crew can now read these instructions in Worker view.');
    } catch (reason) {
      setEditError(
        reason instanceof Error ? reason.message : 'Could not publish. Your draft has been kept.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus(task: WorkTask, status: WorkStatus, helpNote?: string) {
    setBusy(task.id);
    setError('');
    try {
      const data = await query<{ setWorkStatus: WorkTask }>(
        'mutation Status($orchardId: ID!, $taskId: ID!, $revision: Int!, $status: String!, $helpNote: String) { setWorkStatus(orchardId: $orchardId, taskId: $taskId, revision: $revision, status: $status, helpNote: $helpNote) { ' +
          TASK_FIELDS +
          ' } }',
        { orchardId, taskId: task.id, revision: task.revision, status, helpNote },
      );
      applyTask(data.setWorkStatus);
      setNotice(
        es
          ? 'Estado actualizado. El encargado puede verlo.'
          : 'Status updated. Management can see your progress.',
      );
      return true;
    } catch (reason) {
      setError(
        es
          ? 'No se pudo guardar. Actualiza la lista e inténtalo de nuevo.'
          : reason instanceof Error
            ? reason.message
            : 'Could not save. Please try again.',
      );
      return false;
    } finally {
      setBusy(null);
    }
  }
  const done = tasks.filter((t) => t.status === 'done').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const shown = tasks
    .filter((t) => filter === 'all' || t.status === filter)
    .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));

  return (
    <div lang={lang}>
      <a className="skip-link" href="#work-list">
        {es ? 'Ir a las tareas' : 'Skip to tasks'}
      </a>
      <header className="topbar">
        <a className="brand" href="#management" aria-label="Orchard Briefing home">
          <svg width="30" height="34" viewBox="0 0 30 34" fill="none" aria-hidden="true">
            <path d="M15 32V12M15 21L6 13M15 26L25 16" stroke="currentColor" strokeWidth="2" />
            <path
              d="M15 2C3 2 0 11 7 17C10 19 13 18 15 15C17 18 20 19 23 17C30 11 27 2 15 2Z"
              fill="currentColor"
              opacity=".2"
            />
          </svg>
          <span>
            Orchard<span className="brand-light">Briefing</span>
          </span>
        </a>
        <nav className="view-nav" aria-label={es ? 'Vista del huerto' : 'Orchard view'}>
          <button
            className={manager ? 'selected' : ''}
            aria-pressed={manager}
            onClick={() => chooseView('management')}
          >
            {es ? 'Gestión' : 'Management'}
          </button>
          <button
            className={!manager ? 'selected' : ''}
            aria-pressed={!manager}
            onClick={() => chooseView('worker')}
          >
            {es ? 'Equipo' : 'Worker'}
          </button>
        </nav>
        <span className="demo-badge">{es ? 'Huerto de muestra' : 'Demo orchard'}</span>
      </header>
      <main className="app-shell">
        <section className="intro">
          <div>
            <p className="eyebrow">
              {manager
                ? 'A CLEAR START FOR THE WHOLE CREW'
                : es
                  ? 'LAS INSTRUCCIONES, A MANO'
                  : 'YOUR INSTRUCTIONS, AT HAND'}
            </p>
            <h1>
              {manager ? (
                <>
                  Good work starts with
                  <br />
                  <em>clear instructions.</em>
                </>
              ) : es ? (
                'El trabajo de hoy.'
              ) : (
                'Today’s work.'
              )}
            </h1>
            <p>
              {manager
                ? 'Prepare the work in English and Spanish. Give your crew the details they need, and see how the day is going.'
                : es
                  ? 'Consulta dónde ir, qué llevar y cuándo está terminado. Avisa si necesitas ayuda.'
                  : 'Know where to go, what to bring, and what finished looks like. Ask for help when you need it.'}
            </p>
          </div>
          {manager ? (
            <div className="intro-action">
              <button className="primary" disabled={!ready} onClick={() => openEditor()}>
                {hasDraft(draft) ? 'Continue draft' : '+ New task'}
              </button>
              <button
                className="text-button"
                disabled={!ready}
                onClick={() => openEditor(structuredClone(EXAMPLES[0]))}
              >
                Try a bilingual example →
              </button>
            </div>
          ) : (
            <div
              className="language-control"
              role="group"
              aria-label={es ? 'Idioma de las instrucciones' : 'Instructions language'}
            >
              <span>{es ? 'Tu idioma' : 'Your language'}</span>
              <div>
                <button
                  aria-pressed={language === 'en'}
                  className={language === 'en' ? 'selected' : ''}
                  onClick={() => chooseLanguage('en')}
                >
                  English
                </button>
                <button
                  aria-pressed={language === 'es'}
                  className={language === 'es' ? 'selected' : ''}
                  onClick={() => chooseLanguage('es')}
                >
                  Español
                </button>
              </div>
            </div>
          )}
        </section>
        <div className="preview-bar">
          <span aria-hidden="true">◖))</span>
          <p>
            {es
              ? 'Vista previa: las nuevas grabaciones están en pausa. Puedes leer las tareas y actualizar su estado.'
              : 'New recordings are paused for this preview. All text features are ready to try.'}
          </p>
        </div>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              className="quiet"
              aria-label={es ? 'Cerrar aviso' : 'Dismiss notice'}
              onClick={() => setNotice('')}
            >
              ×
            </button>
          </div>
        )}
        {manager && (
          <div id="task-editor">
            {editor && (
              <TaskEditor
                key={draft.taskId ?? 'new'}
                draft={draft}
                onChange={setDraft}
                onClose={() => setEditor(false)}
                onDiscard={() => {
                  setDraft(emptyDraft());
                  setEditor(false);
                  setNotice('Draft discarded. Published tasks are unchanged.');
                }}
                onPublish={publish}
                saving={saving}
                error={editError}
              />
            )}
          </div>
        )}
        <section id="work-list" className="work-section" aria-labelledby="work-title">
          <div className="section-top">
            <div>
              <p className="eyebrow">
                {manager ? 'THE CREW’S WORK LIST' : es ? 'PASO A PASO' : 'ONE TASK AT A TIME'}
              </p>
              <h2 id="work-title">
                {manager
                  ? 'Today, in the orchard.'
                  : es
                    ? 'Listo para empezar.'
                    : 'Ready for the rows.'}
              </h2>
            </div>
            <button
              className="quiet refresh"
              disabled={loading || !orchardId}
              onClick={() => refresh(orchardId, !ready)}
            >
              {loading ? (es ? 'Cargando…' : 'Loading…') : es ? '↻ Actualizar' : '↻ Refresh'}
            </button>
          </div>
          {manager && (
            <div className="overview">
              <div>
                <strong>{tasks.length - done}</strong>
                <span>Still to do</span>
              </div>
              <div>
                <strong>
                  {done}
                  <small> / {tasks.length}</small>
                </strong>
                <span>Completed</span>
              </div>
              <button className={blocked ? 'has-blocked' : ''} onClick={() => setFilter('blocked')}>
                <strong>{blocked}</strong>
                <span>
                  Need a hand <span aria-hidden="true">↗</span>
                </span>
              </button>
              <div className="progress-summary">
                <span>A little progress, every day.</span>
                <progress value={done} max={tasks.length || 1} aria-label="Tasks completed" />
              </div>
            </div>
          )}
          <div className="filters" role="group" aria-label={es ? 'Filtrar tareas' : 'Filter tasks'}>
            {(Object.keys(FILTERS[lang]) as Filter[]).map((key) => (
              <button
                key={key}
                className={filter === key ? 'selected' : ''}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {FILTERS[lang][key]}
                <span>
                  {key === 'all' ? tasks.length : tasks.filter((t) => t.status === key).length}
                </span>
              </button>
            ))}
          </div>
          {error && (
            <p className="error" role="alert">
              {es && error.startsWith('Could not load')
                ? 'No se pudo cargar la lista. Pulsa Actualizar para intentarlo de nuevo.'
                : error}
            </p>
          )}
          {!ready && (
            <div className="empty-state">
              <h3>
                {loading
                  ? es
                    ? 'Cargando el trabajo…'
                    : 'Getting the work list…'
                  : es
                    ? 'No se pudo cargar la lista.'
                    : 'The work list could not be loaded.'}
              </h3>
              <p>
                {es
                  ? 'Tus cambios se guardan al publicar.'
                  : 'Published work is saved in your demo workspace.'}
              </p>
            </div>
          )}
          {ready && !shown.length && (
            <div className="empty-state">
              <span aria-hidden="true">✓</span>
              <h3>{es ? 'No hay tareas en esta vista.' : 'No tasks in this view.'}</h3>
              <p>
                {es
                  ? 'Selecciona Todas para ver la lista completa.'
                  : 'Choose All tasks to see the whole list, or prepare a new task.'}
              </p>
            </div>
          )}
          <div className="task-grid">
            {shown.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                language={lang}
                manager={manager}
                orchardId={orchardId}
                busy={!!busy || saving}
                onEdit={() => edit(task)}
                onStatus={(status, note) => changeStatus(task, status, note)}
              />
            ))}
          </div>
        </section>
        {manager && ready && <SavedRecordings orchardId={orchardId} />}
        {manager && (
          <section className="handoff">
            <div>
              <p className="eyebrow">SEE THE OTHER SIDE</p>
              <h2>Ready for the crew?</h2>
              <p>
                Switch to Worker view to read the same tasks in Spanish, start work, or send a note
                back.
              </p>
            </div>
            <button className="secondary" onClick={() => chooseView('worker')}>
              Open Worker view <span aria-hidden="true">→</span>
            </button>
          </section>
        )}
      </main>
      <footer>
        <span>
          Orchard Briefing <span aria-hidden="true">/</span>{' '}
          {es ? 'Un buen comienzo, juntos.' : 'A clear start, together.'}
        </span>
        <p>
          {es
            ? 'Demo con tareas ficticias. Ambas vistas comparten la lista de este navegador; no son cuentas separadas.'
            : 'Fictional demo. Both views share this browser’s workspace; they are not separate accounts.'}
        </p>
        <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">
          {es ? 'Voz con ElevenLabs' : 'Voice powered by ElevenLabs'} ↗
        </a>
      </footer>
    </div>
  );
}
