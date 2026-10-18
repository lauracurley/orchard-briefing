'use client';
import { useEffect, useState } from 'react';
import {
  instructionsFor,
  SPECIES_LABELS,
  STATUS_LABELS,
  type Language,
  type WorkStatus,
  type WorkTask,
} from '@/lib/work-order';

export default function TaskCard({
  task,
  language,
  manager,
  orchardId,
  busy,
  onEdit,
  onStatus,
}: {
  task: WorkTask;
  language: Language;
  manager: boolean;
  orchardId: string;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: WorkStatus, note?: string) => Promise<boolean>;
}) {
  const es = language === 'es';
  const details = instructionsFor(task, language);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpNote, setHelpNote] = useState('');
  const [audio, setAudio] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  useEffect(() => {
    let active = true;
    let url: string | null = null;
    const controller = new AbortController();
    setAudio(null);
    setAudioError(false);
    if (details)
      fetch('/api/task-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orchardId, taskId: task.id, language, revision: task.revision }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Audio unavailable');
          if (response.headers.get('Content-Type')?.includes('audio/')) {
            url = URL.createObjectURL(await response.blob());
            if (active) setAudio(url);
            else URL.revokeObjectURL(url);
          }
        })
        .catch(() => {
          if (active) setAudioError(true);
        });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [orchardId, task.id, task.revision, language, !!details]);
  return (
    <article
      className={'task-card status-' + task.status}
      aria-label={details?.title ?? task.title}
    >
      <div className="card-top">
        <span className="tree-label">{es ? SPECIES_LABELS[task.species] : task.species}</span>
        <span className={'status-pill ' + task.status}>
          <span aria-hidden="true">●</span> {STATUS_LABELS[language][task.status]}
        </span>
      </div>
      <h3 lang={details ? language : 'en'}>{details?.title ?? task.title}</h3>
      {!details ? (
        <div className="translation-missing">
          <p>
            Las instrucciones en español aún no están listas. Pide ayuda al encargado antes de
            empezar.
          </p>
          <details>
            <summary>Ver original en inglés</summary>
            <div lang="en">
              <p>{task.title}</p>
              <p>Where: {task.location || 'Not specified'}</p>
              <p>Materials: {task.materialsLocation || 'Not specified'}</p>
              <p>Finished when: {task.doneWhen || 'Not specified'}</p>
            </div>
          </details>
        </div>
      ) : (
        <dl className="task-details">
          <div>
            <dt>{es ? 'Dónde' : 'Where'}</dt>
            <dd>{details.location || (es ? 'Preguntar al encargado' : 'Ask the manager')}</dd>
          </div>
          <div>
            <dt>{es ? 'Materiales' : 'Materials'}</dt>
            <dd>{details.materialsLocation || (es ? 'Sin especificar' : 'Not specified')}</dd>
          </div>
          <div>
            <dt>{es ? 'Se termina cuando' : 'Finished when'}</dt>
            <dd>{details.doneWhen || (es ? 'Preguntar al encargado' : 'Ask the manager')}</dd>
          </div>
        </dl>
      )}
      {task.helpNote && (
        <div className="help-note">
          <strong>{es ? 'Nota del equipo' : 'Crew note'}</strong>
          <p>{task.helpNote}</p>
        </div>
      )}
      <div className="task-audio">
        {audio ? (
          <>
            <span>{es ? 'Escuchar instrucciones' : 'Listen to instructions'}</span>
            <audio
              key={audio}
              controls
              src={audio}
              aria-label={es ? 'Instrucciones grabadas' : 'Recorded instructions'}
            />
            <small>
              {es ? 'Repite la grabación cuando quieras.' : 'Replay this saved recording anytime.'}
            </small>
          </>
        ) : (
          <>
            <span className="audio-symbol" aria-hidden="true">
              ◖))
            </span>
            <span>
              {audioError
                ? es
                  ? 'Grabación no disponible'
                  : 'Recording unavailable'
                : es
                  ? 'Grabación aún no preparada'
                  : 'Recording not prepared yet'}
              <small>
                {es
                  ? 'Puedes leer las instrucciones arriba.'
                  : 'Read the instructions above while audio is paused.'}
              </small>
            </span>
          </>
        )}
      </div>
      <div className="card-actions">
        {manager ? (
          <button className="secondary" onClick={onEdit} disabled={busy}>
            Edit instructions <span aria-hidden="true">↗</span>
          </button>
        ) : (
          <>
            {task.status === 'done' ? (
              <button className="secondary" disabled={busy} onClick={() => onStatus('ready')}>
                {es ? 'Reabrir tarea' : 'Reopen task'}
              </button>
            ) : (
              <>
                {task.status !== 'doing' && (
                  <button
                    className="primary"
                    disabled={busy || !details}
                    onClick={() => onStatus('doing')}
                  >
                    {es ? 'Empezar' : 'Start task'} <span aria-hidden="true">→</span>
                  </button>
                )}
                {task.status === 'doing' && (
                  <button
                    className="primary"
                    disabled={busy || !details}
                    onClick={() => onStatus('done')}
                  >
                    {es ? 'Marcar terminada' : 'Mark done'} <span aria-hidden="true">✓</span>
                  </button>
                )}
                <button className="quiet" disabled={busy} onClick={() => setHelpOpen(!helpOpen)}>
                  {es ? 'Necesito ayuda' : 'Need help'}
                </button>
              </>
            )}
          </>
        )}
      </div>
      {helpOpen && (
        <form
          className="help-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onStatus('blocked', helpNote)) {
              setHelpOpen(false);
              setHelpNote('');
            }
          }}
        >
          <label htmlFor={'help-' + task.id}>
            {es ? '¿Qué necesitas para seguir?' : 'What do you need to continue?'}
          </label>
          <textarea
            id={'help-' + task.id}
            autoFocus
            value={helpNote}
            onChange={(e) => setHelpNote(e.target.value)}
            maxLength={240}
            required
            rows={2}
          />
          <div className="card-actions">
            <button type="submit" className="primary" disabled={busy || !helpNote.trim()}>
              {es ? 'Avisar al encargado' : 'Send to manager'}
            </button>
            <button type="button" className="quiet" onClick={() => setHelpOpen(false)}>
              {es ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
