'use client';
import { uiCopy } from '@/lib/ui-copy';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpRight, Check, Plus, RefreshCw, X } from 'lucide-react';
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
  de: {
    all: 'Alle Aufgaben',
    ready: 'Bereit',
    doing: 'In Arbeit',
    blocked: 'Hilfe benötigt',
    done: 'Erledigt',
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
  const copy = uiCopy(lang);

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
        if (parsed.english && parsed.spanish && typeof parsed.note === 'string')
          setDraft({
            ...emptyDraft(),
            ...parsed,
            includeSpanish: parsed.includeSpanish ?? parsed.bilingual ?? false,
          });
      }
      const savedLanguage = localStorage.getItem('orchard-language');
      if (savedLanguage === 'es' || savedLanguage === 'de') setLanguage(savedLanguage);
    } catch {
      setNotice('Browser storage is unavailable. Keep this page open to retain your draft.');
    }
    setOrchardId(id);
    setStorageReady(true);
    function syncView() {
      window.scrollTo({ top: 0, behavior: 'instant' });
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
    window.scrollTo({ top: 0, behavior: 'instant' });
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
      german: task.german ?? emptyDraft().german,
      includeGerman: !!task.german,
      includeSpanish: !!task.spanish,
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
            spanish: draft.includeSpanish ? draft.spanish : null,
            german: draft.includeGerman ? draft.german : null,
          },
        },
      );
      applyTask(data.saveTask);
      setDraft(emptyDraft());
      setEditor(false);
      setFilter('all');
      setNotice('Published. These instructions are now available in Today’s tasks.');
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
      setNotice(copy.statusUpdatedYourProgressIs);
      return true;
    } catch (reason) {
      setError(lang === 'en' && reason instanceof Error ? reason.message : copy.saveFailed);
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
        {copy.skipToTasks}
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
        <nav className="view-nav" aria-label={copy.orchardView}>
          <Button
            className={manager ? 'selected' : ''}
            aria-pressed={manager}
            onClick={() => chooseView('management')}
          >
            {copy.planWork}
          </Button>
          <Button
            className={!manager ? 'selected' : ''}
            aria-pressed={!manager}
            onClick={() => chooseView('worker')}
          >
            {copy.todaySTasks}
          </Button>
        </nav>
        <span className="demo-badge">{copy.demoOrchard}</span>
      </header>
      <main className="app-shell">
        <section className="intro">
          <div>
            <p className="eyebrow">{manager ? 'PLAN WORK' : copy.tasksEyebrow}</p>
            <h1>{manager ? 'Prepare today’s work.' : copy.tasksHeading}</h1>
            <p>
              {manager
                ? 'Write the task, location, materials, and finish condition. Review each included language before publishing.'
                : copy.taskIntro}
            </p>
          </div>
          {manager ? (
            <div className="intro-action">
              <Button className="primary" disabled={!ready} onClick={() => openEditor()}>
                {hasDraft(draft) ? (
                  'Continue draft'
                ) : (
                  <>
                    <Plus size={16} aria-hidden="true" /> Prepare a task
                  </>
                )}
              </Button>
              <Button
                className="text-button"
                disabled={!ready}
                onClick={() => openEditor(structuredClone(EXAMPLES[0]))}
              >
                Try a translated example <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <div className="language-control" role="group" aria-label={copy.instructionsLanguage}>
              <span>{copy.yourLanguage}</span>
              <div>
                <Button
                  aria-pressed={language === 'en'}
                  className={language === 'en' ? 'selected' : ''}
                  onClick={() => chooseLanguage('en')}
                >
                  English
                </Button>
                <Button
                  aria-pressed={language === 'es'}
                  className={language === 'es' ? 'selected' : ''}
                  onClick={() => chooseLanguage('es')}
                >
                  Español
                </Button>
                <Button
                  aria-pressed={language === 'de'}
                  className={language === 'de' ? 'selected' : ''}
                  onClick={() => chooseLanguage('de')}
                >
                  Deutsch
                </Button>
              </div>
            </div>
          )}
        </section>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <Button className="quiet" aria-label={copy.dismissNotice} onClick={() => setNotice('')}>
              <X size={16} aria-hidden="true" />
            </Button>
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
              <p className="eyebrow">{copy.tasksEyebrow}</p>
              <h2 id="work-title">{manager ? 'Today’s tasks' : copy.workList}</h2>
            </div>
            <Button
              className="quiet refresh"
              disabled={loading || !orchardId}
              onClick={() => refresh(orchardId, !ready)}
            >
              {!loading && <RefreshCw size={16} aria-hidden="true" />}
              {loading ? copy.loading : copy.refresh}
            </Button>
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
              <Button className={blocked ? 'has-blocked' : ''} onClick={() => setFilter('blocked')}>
                <strong>{blocked}</strong>
                <span>
                  Need help <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </Button>
              <div className="progress-summary">
                <span>
                  {done} of {tasks.length} tasks completed
                </span>
                <progress value={done} max={tasks.length || 1} aria-label="Tasks completed" />
              </div>
            </div>
          )}
          <div className="filters" role="group" aria-label={copy.filterTasks}>
            {(Object.keys(FILTERS[lang]) as Filter[]).map((key) => (
              <Button
                key={key}
                className={filter === key ? 'selected' : ''}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {FILTERS[lang][key]}
                <span>
                  {key === 'all' ? tasks.length : tasks.filter((t) => t.status === key).length}
                </span>
              </Button>
            ))}
          </div>
          {error && (
            <p className="error" role="alert">
              {error.startsWith('Could not load') ? copy.loadFailed : error}
            </p>
          )}
          {!ready && (
            <div className="empty-state">
              <h3>{loading ? copy.gettingTasks : copy.loadFailed}</h3>
              <p>{copy.publishedWorkIsSavedIn}</p>
            </div>
          )}
          {ready && !shown.length && (
            <div className="empty-state">
              <Check size={28} aria-hidden="true" />
              <h3>{copy.noTasksInThisView}</h3>
              <p>
                {manager
                  ? 'Choose All tasks to see the whole list, or prepare a new task.'
                  : copy.emptyHint}
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
              <p className="eyebrow">TODAY’S TASKS</p>
              <h2>See the instructions in action</h2>
              <p>
                Open Today’s tasks to read the instructions in English, Spanish or German, start
                work, or ask for help.
              </p>
            </div>
            <Button className="secondary" onClick={() => chooseView('worker')}>
              Open Today’s tasks <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </section>
        )}
      </main>
      <footer>
        <span>Orchard Briefing</span>
        <p>{copy.fictionalDemoBothViewsShare}</p>
        <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">
          {copy.voiceCredit} <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}
