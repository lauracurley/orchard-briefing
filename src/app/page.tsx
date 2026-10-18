'use client';

import { useEffect, useRef, useState } from 'react';
import { SPECIES, type Species } from '@/lib/briefing';

type Task = { id: string; species: Species; title: string; done: boolean };

async function query<T>(source: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: source, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.[0]?.message ?? payload.error ?? 'Something went wrong.');
  return payload.data as T;
}

export default function Home() {
  const orchardId = useRef('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [species, setSpecies] = useState<Species>('Chestnut');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrl = useRef<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('orchard-briefing-id') ?? crypto.randomUUID();
    localStorage.setItem('orchard-briefing-id', id);
    orchardId.current = id;
    query<{ startOrchard: Task[] }>(
      'mutation Start($orchardId: ID!) { startOrchard(orchardId: $orchardId) { id species title done } }',
      { orchardId: id },
    ).then((data) => setTasks(data.startOrchard)).catch((reason) => setError(reason.message)).finally(() => setReady(true));
    return () => { if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); };
  }, []);

  const open = tasks.filter((task) => !task.done);

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await query<{ addTask: Task }>(
        'mutation Add($orchardId: ID!, $species: String!, $title: String!) { addTask(orchardId: $orchardId, species: $species, title: $title) { id species title done } }',
        { orchardId: orchardId.current, species, title },
      );
      setTasks((previous) => [data.addTask, ...previous]);
      setTitle('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add task.'); }
    finally { setBusy(false); }
  }

  async function toggle(task: Task) {
    setError('');
    try {
      const data = await query<{ setTaskDone: Task }>(
        'mutation Done($orchardId: ID!, $taskId: ID!, $done: Boolean!) { setTaskDone(orchardId: $orchardId, taskId: $taskId, done: $done) { id species title done } }',
        { orchardId: orchardId.current, taskId: task.id, done: !task.done },
      );
      setTasks((previous) => previous.map((item) => item.id === task.id ? data.setTaskDone : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update task.'); }
  }

  async function listen() {
    setSpeaking(true); setError('');
    try {
      const response = await fetch('/api/briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orchardId: orchardId.current }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? 'Could not play the briefing.');
      }
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = URL.createObjectURL(await response.blob());
      if (audioRef.current) { audioRef.current.src = audioUrl.current; await audioRef.current.play(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not play the briefing.'); }
    finally { setSpeaking(false); }
  }

  return <main>
    <header className="topbar"><div className="brand"><span className="brand-mark">◎</span> Orchard Briefing</div><span className="top-note">A little clarity for the next walk through the rows</span></header>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">FIELD NOTES · NUT ORCHARDS</p><h1>Give the orchard<br/><em>your attention.</em></h1><p className="lede">Keep a short list for your chestnuts, walnuts, heartnuts, and hazels. Hear the open tasks before you head outside.</p><div className="hero-actions"><button className="primary" onClick={listen} disabled={!ready || speaking || !open.length}>{speaking ? 'Preparing audio…' : '▶  Listen to my briefing'}</button><span className="voice-note">Your next few tasks, read aloud</span></div></div>
      <div className="hero-art" aria-hidden="true"><div className="sun"/><div className="hill hill-back"/><div className="hill hill-front"/><div className="tree tree-one"><i/><b/></div><div className="tree tree-two"><i/><b/></div><div className="tree tree-three"><i/><b/></div><div className="tree tree-four"><i/><b/></div><div className="art-label">GROW · OBSERVE · RETURN</div></div>
    </section>
    <section className="work-area" aria-label="Orchard tasks"><div className="section-heading"><div><p className="eyebrow">YOUR FIELD LIST</p><h2>What needs a look?</h2></div><span className="count">{open.length} open {open.length === 1 ? 'task' : 'tasks'}</span></div>
      <div className="columns"><div className="task-panel">{!ready && <p className="empty">Loading your field list…</p>}{ready && !tasks.length && <p className="empty">Add your first orchard task.</p>}{tasks.map((task) => <label className={`task ${task.done ? 'done' : ''}`} key={task.id}><input type="checkbox" checked={task.done} onChange={() => toggle(task)}/><span className="custom-check" aria-hidden="true"/><span className="task-text"><span className="species">{task.species}</span><span>{task.title}</span></span></label>)}</div>
      <aside className="add-panel"><div className="panel-icon">＋</div><h3>Add a field note</h3><p>Keep it specific enough to act on during one orchard walk.</p><form onSubmit={addTask}><label htmlFor="species">Tree</label><select id="species" value={species} onChange={(event) => setSpecies(event.target.value as Species)}>{SPECIES.map((item) => <option key={item}>{item}</option>)}</select><label htmlFor="title">Task</label><input id="title" type="text" placeholder="e.g. Check tree guards in the north row" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} required/><button className="secondary" type="submit" disabled={busy || !ready}>Add to list <span aria-hidden="true">→</span></button></form></aside></div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    <footer><span>Made for the quiet work of growing nut trees.</span><span>Demo lists are linked to this browser. Powered by <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">ElevenLabs</a>.</span></footer>
    <audio ref={audioRef} controls className="audio" aria-label="Spoken orchard briefing"/>
  </main>;
}
