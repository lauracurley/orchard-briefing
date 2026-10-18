'use client';

import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { useEffect, useRef, useState } from 'react';
import { SPECIES, type Species } from '@/lib/briefing';
import { parseAgentDraft } from '@/lib/task-draft';
import { MAX_NOTE_SECONDS } from '@/lib/voice-note';

type Task = { id: string; species: Species; title: string; location: string | null; doneWhen: string | null; done: boolean };
type AgentStatus = 'idle' | 'connecting' | 'working' | 'question' | 'ready';

const TASK_FIELDS = 'id species title location doneWhen done';
const SAMPLE_NOTE = 'The guards in the west chestnut rows looked loose after last night’s wind. Check them before lunch.';

async function query<T>(source: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: source, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.[0]?.message ?? payload.error ?? 'Something went wrong.');
  return payload.data as T;
}

function HomeContent({ captureEnabled }: { captureEnabled: boolean }) {
  const orchardId = useRef('');
  const noteToSend = useRef('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrl = useRef<string | null>(null);
  const audioKey = useRef('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState('');
  const [clip, setClip] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [agentMessage, setAgentMessage] = useState('');
  const [reply, setReply] = useState('');
  const [species, setSpecies] = useState<Species | ''>('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [doneWhen, setDoneWhen] = useState('');
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');

  const conversation = useConversation({
    textOnly: true,
    onConnect: () => { setAgentStatus('working'); conversation.sendUserMessage('Turn this field note into one clear draft task: ' + noteToSend.current); },
    onMessage: ({ role, message }) => { if (role === 'agent') { setAgentMessage(message); setAgentStatus((value) => value === 'ready' ? value : 'question'); } },
    onError: () => { setAgentStatus('idle'); setError('Task suggestions are unavailable. You can write the task yourself.'); },
    clientTools: {
      proposeTask: (values: Record<string, unknown>) => {
        let draft;
        try { draft = parseAgentDraft(values); } catch { return 'Please provide a short action and keep each field within its limit.'; }
        setTitle(draft.title);
        setSpecies(draft.species);
        setLocation(draft.location);
        setDoneWhen(draft.doneWhen);
        setAgentStatus('ready');
        setAgentMessage('Here is a draft. Check every detail before adding it to the list.');
        return 'Draft displayed for review. The grower must approve it before it is saved.';
      },
    },
  });

  useEffect(() => {
    const id = localStorage.getItem('orchard-briefing-id') ?? crypto.randomUUID();
    localStorage.setItem('orchard-briefing-id', id);
    orchardId.current = id;
    query<{ startOrchard: Task[] }>(
      'mutation Start($orchardId: ID!) { startOrchard(orchardId: $orchardId) { ' + TASK_FIELDS + ' } }',
      { orchardId: id },
    ).then((data) => setTasks(data.startOrchard)).catch((reason) => setError(reason.message)).finally(() => setReady(true));
    return () => {
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, []);

  const open = tasks.filter((task) => !task.done);
  const currentAudioKey = JSON.stringify(open.map(({ id, species: tree, title: taskTitle, location: place, doneWhen: criterion }) => [id, tree, taskTitle, place, criterion]));

  function loadSample() {
    setNote(SAMPLE_NOTE);
    setClip(null);
    setSpecies('Chestnut');
    setTitle('Check tree guards before lunch');
    setLocation('West chestnut rows');
    setDoneWhen('');
    setAgentStatus('ready');
    setAgentMessage('Sample task filled in. Check the details, then add what counts as done.');
  }

  async function startRecording() {
    setError(''); setClip(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported here. You can type a note instead.'); return;
    }
    try {
      const tracks = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = tracks;
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(tracks, { mimeType }) : new MediaRecorder(tracks);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        tracks.getTracks().forEach((track) => track.stop());
        stream.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (blob.size > 100) {
          const extension = recorder.mimeType.includes('mp4') ? 'mp4' : recorder.mimeType.includes('ogg') ? 'ogg' : 'webm';
          setClip(new File([blob], 'field-note.' + extension, { type: recorder.mimeType }));
        }
        setRecording(false);
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
      recordingTimer.current = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, MAX_NOTE_SECONDS * 1000);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError('Microphone access was not available. You can type a note instead.');
    }
  }

  function stopRecording() {
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
  }

  async function transcribe() {
    if (!clip) return;
    setTranscribing(true); setError('');
    try {
      const form = new FormData();
      form.set('orchardId', orchardId.current);
      form.set('audio', clip);
      const response = await fetch('/api/transcribe', { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not transcribe the note.');
      setNote(payload.transcript);
      setClip(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not transcribe the note.'); }
    finally { setTranscribing(false); }
  }

  async function suggestTask() {
    if (!note.trim() || !ready) return;
    setError(''); setAgentMessage(''); setAgentStatus('connecting');
    noteToSend.current = note.trim().slice(0, 1500);
    try {
      const response = await fetch('/api/agent-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orchardId: orchardId.current }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Task suggestions are unavailable.');
      conversation.startSession({ signedUrl: payload.signedUrl, textOnly: true });
    } catch (reason) {
      setAgentStatus('idle');
      setError(reason instanceof Error ? reason.message : 'Task suggestions are unavailable.');
    }
  }

  function sendReply() {
    if (!reply.trim() || conversation.status !== 'connected') return;
    conversation.sendUserMessage(reply.trim());
    setReply(''); setAgentStatus('working'); setAgentMessage('');
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!species || !title.trim()) return;
    setSaving(true); setError('');
    try {
      const data = await query<{ addTask: Task }>(
        'mutation Add($orchardId: ID!, $species: String!, $title: String!, $location: String, $doneWhen: String) { addTask(orchardId: $orchardId, species: $species, title: $title, location: $location, doneWhen: $doneWhen) { ' + TASK_FIELDS + ' } }',
        { orchardId: orchardId.current, species, title, location, doneWhen },
      );
      setTasks((previous) => [data.addTask, ...previous]);
      setTitle(''); setSpecies(''); setLocation(''); setDoneWhen(''); setNote('');
      setAgentMessage(''); setAgentStatus('idle'); conversation.endSession();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add task.'); }
    finally { setSaving(false); }
  }

  async function toggle(task: Task) {
    setError('');
    try {
      const data = await query<{ setTaskDone: Task }>(
        'mutation Done($orchardId: ID!, $taskId: ID!, $done: Boolean!) { setTaskDone(orchardId: $orchardId, taskId: $taskId, done: $done) { ' + TASK_FIELDS + ' } }',
        { orchardId: orchardId.current, taskId: task.id, done: !task.done },
      );
      setTasks((previous) => previous.map((item) => item.id === task.id ? data.setTaskDone : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update task.'); }
  }

  async function listen() {
    setSpeaking(true); setError('');
    try {
      if (audioUrl.current && audioKey.current === currentAudioKey && audioRef.current) {
        await audioRef.current.play(); return;
      }
      const response = await fetch('/api/briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orchardId: orchardId.current }),
      });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.error ?? 'Could not play the briefing.'); }
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = URL.createObjectURL(await response.blob());
      audioKey.current = currentAudioKey;
      if (audioRef.current) { audioRef.current.src = audioUrl.current; await audioRef.current.play(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not play the briefing.'); }
    finally { setSpeaking(false); }
  }

  return <main>
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark">◎</span> Orchard Briefing</a><a className="header-link" href="#today">Today’s work <span aria-hidden="true">↗</span></a></header>
    <section className="hero" id="top">
      <div className="hero-copy"><p className="eyebrow">A CLEAR START IN THE ORCHARD</p><h1>Know what needs doing <em>before you head out.</em></h1><p className="lede">Turn a quick field note into a clear task. Review it, add it to today’s work, and hear the list read aloud.</p><div className="hero-actions"><a className="primary" href="#new-note">Make a field note <span aria-hidden="true">→</span></a><button className="text-action" onClick={listen} disabled={!ready || speaking || !open.length}>{speaking ? 'Preparing…' : '▶  Hear today’s work'}</button></div></div>
      <div className="hero-art" aria-hidden="true"><div className="sun"/><div className="hill hill-back"/><div className="hill hill-front"/><div className="tree tree-one"><i/><b/></div><div className="tree tree-two"><i/><b/></div><div className="tree tree-three"><i/><b/></div><div className="tree tree-four"><i/><b/></div><div className="art-label">CHESTNUT · WALNUT · HEARTNUT · HAZEL</div></div>
    </section>
    <section className="workspace" aria-label="Field work">
      <div className="section-heading"><p className="eyebrow">FROM NOTE TO WORK LIST</p><h2>A little clarity goes a long way.</h2><p>Start with what you noticed. Check the task before anyone acts on it.</p></div>
      <div className="work-grid">
        <section className="note-panel" id="new-note" aria-labelledby="note-heading"><div className="step">01 / FIELD NOTE</div><h3 id="note-heading">What did you notice?</h3><p>Say it as you remember it. You can tidy the task before adding it to the list.</p>
          {captureEnabled && <div className="record-row"><button type="button" className={recording ? 'record-button recording' : 'record-button'} onClick={recording ? stopRecording : startRecording} disabled={!ready || transcribing}>{recording ? '■  Stop recording' : '●  Record a note'}</button><span>Up to {MAX_NOTE_SECONDS} seconds</span></div>}
          {captureEnabled && clip && <button type="button" className="inline-button" onClick={transcribe} disabled={transcribing}>{transcribing ? 'Turning speech into text…' : 'Turn recording into text →'}</button>}
          <label htmlFor="rough-note">Your note</label><textarea id="rough-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1500} rows={5} placeholder="What happened? Where? When does it need attention?"/>
          <div className="note-actions"><button type="button" className="inline-button" onClick={loadSample}>See a sample note and task →</button>{captureEnabled && <button type="button" className="secondary" onClick={suggestTask} disabled={!ready || !note.trim() || agentStatus === 'connecting' || agentStatus === 'working' || conversation.status === 'connected'}>{agentStatus === 'connecting' || agentStatus === 'working' ? 'Preparing a task…' : 'Make a clear task →'}</button>}</div>
          {agentMessage && <div className="agent-message" role="status">{agentMessage}</div>}
          {agentStatus === 'question' && conversation.status === 'connected' && <div className="reply-row"><label htmlFor="reply">Your answer</label><input id="reply" value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendReply(); }} placeholder="Add the missing detail"/><button type="button" className="inline-button" onClick={sendReply}>Send answer →</button></div>}
        </section>
        <section className="draft-panel" aria-labelledby="draft-heading"><div className="step">02 / CHECK THE TASK</div><h3 id="draft-heading">Make it clear for the next person.</h3><p>Check every detail. Leave anything uncertain blank until you know.</p><form onSubmit={addTask}>
          <label htmlFor="species">Tree</label><select id="species" value={species} onChange={(event) => setSpecies(event.target.value as Species | '')} required><option value="">Choose a tree</option>{SPECIES.map((item) => <option key={item}>{item}</option>)}</select>
          <label htmlFor="title">What needs doing?</label><input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Check the tree guards" required/>
          <label htmlFor="location">Where?</label><input id="location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={60} placeholder="West chestnut rows"/>
          <label htmlFor="done-when">How will you know it’s done?</label><input id="done-when" value={doneWhen} onChange={(event) => setDoneWhen(event.target.value)} maxLength={120} placeholder="Every guard is checked"/>
          <button className="secondary save-button" type="submit" disabled={!ready || saving || !species || !title.trim()}>{saving ? 'Adding…' : 'Approve and add to list →'}</button>
        </form></section>
      </div>
      <section className="today" id="today" aria-labelledby="today-heading"><div className="today-heading"><div><p className="eyebrow">03 / TODAY’S WORK</p><h2 id="today-heading">Ready for the rows.</h2><p>A short list you can read here or hear before heading out.</p></div><button className="primary listen-button" type="button" onClick={listen} disabled={!ready || speaking || !open.length}>{speaking ? 'Preparing audio…' : '▶  Hear today’s work'}</button></div>
        <div className="task-list">{!ready && <p className="empty">Loading today’s work…</p>}{ready && !tasks.length && <p className="empty">Add a task to start your list.</p>}{tasks.map((task) => <label className={task.done ? 'task done' : 'task'} key={task.id}><input type="checkbox" checked={task.done} onChange={() => toggle(task)}/><span className="custom-check" aria-hidden="true"/><span className="task-text"><span className="species">{task.species}{task.location ? ' · ' + task.location : ''}</span><strong>{task.title}</strong>{task.doneWhen && <small>Done when: {task.doneWhen}</small>}</span></label>)}</div>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    <footer><span>Made for the quiet work of growing nut trees.</span><span>Fictional demo · Lists stay with this browser · Powered by <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">ElevenLabs</a></span></footer>
    <audio ref={audioRef} controls className="audio" aria-label="Spoken orchard briefing"/>
  </main>;
}

export default function OrchardApp({ captureEnabled }: { captureEnabled: boolean }) {
  return <ConversationProvider><HomeContent captureEnabled={captureEnabled}/></ConversationProvider>;
}
