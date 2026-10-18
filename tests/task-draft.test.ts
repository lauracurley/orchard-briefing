import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAgentDraft } from '../src/lib/task-draft';
import { readTranscript, validateAudio } from '../src/lib/voice-note';

test('agent draft keeps unknown species blank and does not invent missing details', () => {
  assert.deepEqual(parseAgentDraft({ title: '  Check   guards  ', species: 'Oak' }), {
    title: 'Check guards',
    species: '',
    location: '',
    materialsLocation: '',
    doneWhen: '',
  });
});

test('agent draft rejects missing or oversized instructions', () => {
  assert.throws(() => parseAgentDraft({ species: 'Hazel' }));
  assert.throws(() => parseAgentDraft({ title: 'x'.repeat(121) }));
  assert.throws(() => parseAgentDraft({ title: 'Check guards', location: 'x'.repeat(61) }));
  assert.throws(() =>
    parseAgentDraft({ title: 'Check guards', materialsLocation: 'x'.repeat(161) }),
  );
});

test('recording validation accepts a short clip and rejects unexpected files', () => {
  validateAudio(new File([new Uint8Array(200)], 'note.webm', { type: 'audio/webm;codecs=opus' }));
  assert.throws(() =>
    validateAudio(new File([new Uint8Array(200)], 'note.txt', { type: 'text/plain' })),
  );
  assert.throws(() =>
    validateAudio(new File([new Uint8Array(1_500_001)], 'note.webm', { type: 'audio/webm' })),
  );
});

test('transcription response must contain bounded text', () => {
  assert.equal(readTranscript({ text: '  Check the hazels.  ' }), 'Check the hazels.');
  assert.throws(() => readTranscript({ text: '' }));
  assert.throws(() => readTranscript({ text: 'x'.repeat(1501) }));
});
