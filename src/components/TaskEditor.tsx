'use client';
import { Button } from '@/components/ui/button';
import { ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import { SPECIES, type Species } from '@/lib/briefing';
import { EXAMPLES, type Instructions, type WorkDraft } from '@/lib/work-order';

const fields: {
  key: keyof Instructions;
  label: string;
  es: string;
  de: string;
  limit: number;
  placeholder: string;
}[] = [
  {
    key: 'title',
    label: 'What needs doing?',
    es: '¿Qué hay que hacer?',
    de: 'Was ist zu tun?',
    limit: 120,
    placeholder: 'Check the tree guards',
  },
  {
    key: 'location',
    label: 'Where is the work?',
    es: '¿Dónde está el trabajo?',
    de: 'Wo ist die Arbeit?',
    limit: 60,
    placeholder: 'East fence',
  },
  {
    key: 'materialsLocation',
    label: 'Materials and where to find them',
    es: 'Materiales y dónde encontrarlos',
    de: 'Material und Aufbewahrungsort',
    limit: 160,
    placeholder: 'Spare stakes and ties: North Shed',
  },
  {
    key: 'doneWhen',
    label: 'Finished when…',
    es: 'Se termina cuando…',
    de: 'Erledigt, wenn…',
    limit: 120,
    placeholder: 'Every guard checked; unresolved damage reported.',
  },
];
export default function TaskEditor({
  draft,
  onChange,
  onClose,
  onDiscard,
  onPublish,
  saving,
  error,
}: {
  draft: WorkDraft;
  onChange: (draft: WorkDraft) => void;
  onClose: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  saving: boolean;
  error: string;
}) {
  const [step, setStep] = useState(draft.english.title ? 2 : 1);
  const [reviewed, setReviewed] = useState(false);
  function change(next: WorkDraft) {
    onChange(next);
    setReviewed(false);
  }
  function next() {
    // Custom prose remains intact for manual review; never invent a translation or missing facts.
    if (!draft.english.title)
      change({
        ...draft,
        english: {
          ...draft.english,
          title: draft.note
            .split(/[.!?\n]/)[0]
            .trim()
            .slice(0, 120),
        },
      });
    setStep(2);
  }
  return (
    <section className="editor panel" aria-labelledby="editor-title">
      <div className="section-top">
        <div>
          <p className="eyebrow">{draft.taskId ? 'EDIT INSTRUCTIONS' : 'PREPARE A TASK'}</p>
          <h2 id="editor-title">{step === 1 ? 'Describe the task' : 'Review the instructions'}</h2>
        </div>
        <Button className="quiet" onClick={onClose} disabled={saving}>
          Close <X size={16} aria-hidden="true" />
        </Button>
      </div>
      <ol className="steps" aria-label="Task preparation">
        <li className={step === 1 ? 'active' : ''}>
          <Button onClick={() => setStep(1)} disabled={saving}>
            <span>1</span> Your note
          </Button>
        </li>
        <li className={step === 2 ? 'active' : ''}>
          <Button onClick={next} disabled={saving || (!draft.note.trim() && !draft.english.title)}>
            <span>2</span> Review & publish
          </Button>
        </li>
      </ol>
      {step === 1 ? (
        <div className="note-layout">
          <div>
            <label htmlFor="note">Your rough note</label>
            <textarea
              autoFocus
              id="note"
              rows={6}
              maxLength={1500}
              value={draft.note}
              onChange={(e) => change({ ...draft, note: e.target.value })}
              placeholder="What needs doing, where, and where can the crew find the materials?"
            />
            <p className="muted">
              Include the work, location, materials, and what counts as finished. You can edit every
              field before publishing.
            </p>
            <Button
              className="primary"
              onClick={next}
              disabled={!draft.note.trim() && !draft.english.title}
            >
              Review instructions <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
          <aside className="example-box">
            <span className="eyebrow">EXAMPLE TASK</span>
            <h3>Check tree guards</h3>
            <p>
              Tree guards need checking along the east fence. Stakes and ties are in the north shed.
            </p>
            <Button
              className="secondary"
              disabled={!!draft.note.trim() || !!draft.english.title}
              onClick={() => {
                change(structuredClone(EXAMPLES[0]));
                setStep(2);
              }}
            >
              Use example <ArrowRight size={16} aria-hidden="true" />
            </Button>
            <small>
              Includes prepared English, Spanish and German wording. Start an empty draft to use it.
            </small>
          </aside>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reviewed) onPublish();
          }}
        >
          {draft.note && (
            <details className="source-note">
              <summary>Your original note</summary>
              <p>{draft.note}</p>
            </details>
          )}
          <p className="preview-notice">
            Automatic rewriting and translation are paused in this preview. Edit the wording below,
            or use a prepared example.
          </p>
          <div className="editor-options">
            <label>
              Tree
              <select
                value={draft.species}
                onChange={(e) => change({ ...draft, species: e.target.value as Species })}
              >
                {SPECIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.includeSpanish}
                onChange={(e) => change({ ...draft, includeSpanish: e.target.checked })}
              />
              Include Spanish instructions
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.includeGerman}
                onChange={(e) => change({ ...draft, includeGerman: e.target.checked })}
              />
              Include German instructions
            </label>
          </div>
          <div
            className={
              draft.includeSpanish || draft.includeGerman
                ? 'translation-grid'
                : 'translation-grid single'
            }
          >
            {(
              [
                'english',
                ...(draft.includeSpanish ? ['spanish'] : []),
                ...(draft.includeGerman ? ['german'] : []),
              ] as ('english' | 'spanish' | 'german')[]
            ).map((language) => (
              <fieldset
                key={language}
                lang={language === 'german' ? 'de' : language === 'spanish' ? 'es' : 'en'}
              >
                <legend>
                  {language === 'german'
                    ? 'Deutsch'
                    : language === 'english'
                      ? 'English'
                      : 'Español'}
                </legend>
                {fields.map((field) => (
                  <label key={field.key}>
                    {language === 'german'
                      ? field.de
                      : language === 'english'
                        ? field.label
                        : field.es}
                    <input
                      value={draft[language][field.key]}
                      maxLength={field.limit}
                      required={
                        field.key !== 'materialsLocation' ||
                        (language !== 'english' && !!draft.english.materialsLocation)
                      }
                      placeholder={language === 'english' ? field.placeholder : ''}
                      onChange={(e) =>
                        change({
                          ...draft,
                          [language]: {
                            ...draft[language],
                            [field.key]: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          {(draft.includeSpanish || draft.includeGerman) && (
            <p className="muted">
              Keep names on signs, such as “North Shed,” recognizable in every language. Have a
              fluent speaker check translated instructions before real field use.
            </p>
          )}
          <label className="check-label review-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I checked the action, location, materials and completion instructions
            {draft.includeSpanish || draft.includeGerman ? ' in every included language' : ''}.
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="editor-footer">
            <div>
              <strong>Review the text before sharing it.</strong>
              <small>Publishing shares the text. It won’t create a new recording.</small>
            </div>
            <Button className="primary" type="submit" disabled={saving || !reviewed}>
              {saving ? 'Publishing…' : draft.taskId ? 'Publish changes' : 'Publish task'}
            </Button>
          </div>
        </form>
      )}
      <div className="draft-footer">
        <small>Draft saved on this device when browser storage is available.</small>
        <Button className="text-button" onClick={onDiscard} disabled={saving}>
          Discard draft
        </Button>
      </div>
    </section>
  );
}
