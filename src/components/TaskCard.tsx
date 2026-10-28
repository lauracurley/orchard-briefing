'use client';
import { uiCopy } from '@/lib/ui-copy';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowUpRight, Check, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const copy = uiCopy(language);
  const es = language === 'es';
  const details = instructionsFor(task, language);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpNote, setHelpNote] = useState('');
  const [audio, setAudio] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<'limit' | 'changed' | 'failed' | null>(
    null,
  );
  const audioUrl = useRef<string | null>(null);
  const version = useRef(0);
  useEffect(() => {
    ++version.current;
    setGenerating(false);
    setGenerationError(null);
    let active = true;
    const controller = new AbortController();
    setAudio(null);
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
            const url = URL.createObjectURL(await response.blob());
            if (active) {
              audioUrl.current = url;
              setAudio(url);
            } else URL.revokeObjectURL(url);
          }
        })
        .catch(() => {
          /* The explicit recording action lets the user retry. */
        });
    return () => {
      active = false;
      controller.abort();
      ++version.current;
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = null;
    };
  }, [orchardId, task.id, task.revision, language, !!details]);
  async function createRecording() {
    const requestedVersion = version.current;
    setGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch('/api/task-audio/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orchardId, taskId: task.id, language, revision: task.revision }),
        signal: AbortSignal.timeout(45000),
      });
      if (requestedVersion !== version.current) return;
      if (!response.ok || !response.headers.get('Content-Type')?.includes('audio/')) {
        setGenerationError(
          response.status === 429 ? 'limit' : response.status === 409 ? 'changed' : 'failed',
        );
        return;
      }
      const blob = await response.blob();
      if (requestedVersion !== version.current) return;
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = URL.createObjectURL(blob);
      setAudio(audioUrl.current);
    } catch {
      if (requestedVersion === version.current) setGenerationError('failed');
    } finally {
      if (requestedVersion === version.current) setGenerating(false);
    }
  }
  return (
    <article
      className={'task-card status-' + task.status}
      aria-label={details?.title ?? task.title}
    >
      <div className="card-top">
        <span className="tree-label">
          {language === 'de'
            ? {
                Chestnut: 'Esskastanie',
                Walnut: 'Walnuss',
                Heartnut: 'Herznuss',
                Hazel: 'Haselnuss',
              }[task.species]
            : es
              ? SPECIES_LABELS[task.species]
              : task.species}
        </span>
        <span className={'status-pill ' + task.status}>
          <span aria-hidden="true">●</span> {STATUS_LABELS[language][task.status]}
        </span>
      </div>
      <h3 lang={details ? language : 'en'}>{details?.title ?? task.title}</h3>
      {!details ? (
        <div className="translation-missing">
          <p>{copy.translationMissing}</p>
          <details>
            <summary>{copy.showEnglish}</summary>
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
            <dt>{copy.where}</dt>
            <dd>{details.location || copy.askTheTeam}</dd>
          </div>
          <div>
            <dt>{copy.materials}</dt>
            <dd>{details.materialsLocation || copy.notSpecified}</dd>
          </div>
          <div>
            <dt>{copy.finishedWhen}</dt>
            <dd>{details.doneWhen || copy.askTheTeam}</dd>
          </div>
        </dl>
      )}
      {task.helpNote && (
        <div className="help-note">
          <strong>{copy.crewNote}</strong>
          <p>{task.helpNote}</p>
        </div>
      )}
      {audio && (
        <div className="task-audio">
          <span>{copy.listenToInstructions}</span>
          <audio key={audio} controls src={audio} aria-label={copy.recordedInstructions} />
        </div>
      )}
      {!audio && details && (
        <div className="recording-actions">
          <Button className="secondary" onClick={createRecording} disabled={generating || busy}>
            <Volume2 size={16} aria-hidden="true" />{' '}
            {generating ? copy.creatingRecording : copy.createRecording}
          </Button>
          {generationError && (
            <p className="error" role="alert">
              {generationError === 'limit'
                ? copy.recordingLimit
                : generationError === 'changed'
                  ? copy.recordingChanged
                  : copy.recordingFailed}
            </p>
          )}
        </div>
      )}
      <div className="card-actions">
        {manager ? (
          <Button className="secondary" onClick={onEdit} disabled={busy}>
            Edit instructions <ArrowUpRight size={16} aria-hidden="true" />
          </Button>
        ) : (
          <>
            {task.status === 'done' ? (
              <Button className="secondary" disabled={busy} onClick={() => onStatus('ready')}>
                {copy.reopenTask}
              </Button>
            ) : (
              <>
                {task.status !== 'doing' && (
                  <Button
                    className="primary"
                    disabled={busy || !details}
                    onClick={() => onStatus('doing')}
                  >
                    {copy.startTask} <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                )}
                {task.status === 'doing' && (
                  <Button
                    className="primary"
                    disabled={busy || !details}
                    onClick={() => onStatus('done')}
                  >
                    {copy.markDone} <Check size={16} aria-hidden="true" />
                  </Button>
                )}
                <Button className="quiet" disabled={busy} onClick={() => setHelpOpen(!helpOpen)}>
                  {copy.needHelp}
                </Button>
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
          <label htmlFor={'help-' + task.id}>{copy.whatDoYouNeedTo}</label>
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
            <Button type="submit" className="primary" disabled={busy || !helpNote.trim()}>
              {copy.sendHelpRequest}
            </Button>
            <Button type="button" className="quiet" onClick={() => setHelpOpen(false)}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
