'use client';
import { useState } from 'react';
import { SPECIES, type Species } from '@/lib/briefing';
import { EXAMPLES, type Instructions, type WorkDraft } from '@/lib/work-order';

const fields: {
  key: keyof Instructions;
  label: string;
  es: string;
  limit: number;
  placeholder: string;
}[] = [
  {
    key: 'title',
    label: 'What needs doing?',
    es: '¿Qué hay que hacer?',
    limit: 120,
    placeholder: 'Check the tree guards',
  },
  {
    key: 'location',
    label: 'Where is the work?',
    es: '¿Dónde está el trabajo?',
    limit: 60,
    placeholder: 'East fence',
  },
  {
    key: 'materialsLocation',
    label: 'Materials and where to find them',
    es: 'Materiales y dónde encontrarlos',
    limit: 160,
    placeholder: 'Spare stakes and ties: North Shed',
  },
  {
    key: 'doneWhen',
    label: 'Finished when…',
    es: 'Se termina cuando…',
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
          <h2 id="editor-title">
            {step === 1 ? 'Start with what you know.' : 'Make it clear before it goes out.'}
          </h2>
        </div>
        <button className="quiet" onClick={onClose} disabled={saving}>
          Close <span aria-hidden="true">×</span>
        </button>
      </div>
      <ol className="steps" aria-label="Task preparation">
        <li className={step === 1 ? 'active' : ''}>
          <button onClick={() => setStep(1)} disabled={saving}>
            <span>1</span> Your note
          </button>
        </li>
        <li className={step === 2 ? 'active' : ''}>
          <button onClick={next} disabled={saving || (!draft.note.trim() && !draft.english.title)}>
            <span>2</span> Review & publish
          </button>
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
              A few details are enough to start. You’ll edit the instructions before anyone sees
              them.
            </p>
            <button
              className="primary"
              onClick={next}
              disabled={!draft.note.trim() && !draft.english.title}
            >
              Review instructions <span aria-hidden="true">→</span>
            </button>
          </div>
          <aside className="example-box">
            <span className="eyebrow">TRY THE HANDOFF</span>
            <h3>A ready-made bilingual example</h3>
            <p>
              Tree guards need checking along the east fence. Stakes and ties are in the north shed.
            </p>
            <button
              className="secondary"
              disabled={!!draft.note.trim() || !!draft.english.title}
              onClick={() => {
                change(structuredClone(EXAMPLES[0]));
                setStep(2);
              }}
            >
              Use example →
            </button>
            <small>
              Includes prepared English and Spanish wording. Start an empty draft to use it.
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
                checked={draft.bilingual}
                onChange={(e) => change({ ...draft, bilingual: e.target.checked })}
              />
              Include Spanish instructions
            </label>
          </div>
          <div className={draft.bilingual ? 'translation-grid' : 'translation-grid single'}>
            {(['english', ...(draft.bilingual ? ['spanish'] : [])] as const).map((language) => (
              <fieldset key={language} lang={language === 'spanish' ? 'es' : 'en'}>
                <legend>{language === 'english' ? 'English' : 'Español'}</legend>
                {fields.map((field) => (
                  <label key={field.key}>
                    {language === 'english' ? field.label : field.es}
                    <input
                      value={draft[language as 'english' | 'spanish'][field.key]}
                      maxLength={field.limit}
                      required={
                        field.key !== 'materialsLocation' ||
                        (language === 'spanish' && !!draft.english.materialsLocation)
                      }
                      placeholder={language === 'english' ? field.placeholder : ''}
                      onChange={(e) =>
                        change({
                          ...draft,
                          [language]: {
                            ...draft[language as 'english' | 'spanish'],
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
          {draft.bilingual && (
            <p className="muted">
              Keep names on signs, such as “North Shed,” recognizable in both languages. Have a
              fluent speaker check Spanish instructions before real field use.
            </p>
          )}
          <label className="check-label review-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I checked the action, location, materials and completion instructions
            {draft.bilingual ? ' in both languages' : ''}.
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="editor-footer">
            <div>
              <strong>Text will be ready for the crew.</strong>
              <small>Publishing shares the text. It won’t create a new recording.</small>
            </div>
            <button className="primary" type="submit" disabled={saving || !reviewed}>
              {saving ? 'Publishing…' : draft.taskId ? 'Publish changes →' : 'Publish task →'}
            </button>
          </div>
        </form>
      )}
      <div className="draft-footer">
        <small>Draft saved on this device when browser storage is available.</small>
        <button className="text-button" onClick={onDiscard} disabled={saving}>
          Discard draft
        </button>
      </div>
    </section>
  );
}
