'use client';
import { useEffect, useRef, useState } from 'react';

export default function SavedRecordings({ orchardId }: { orchardId: string }) {
  const [recordings, setRecordings] = useState<{ cacheKey: string; createdAt: string }[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [audio, setAudio] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const audioUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    },
    [],
  );
  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orchardId }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error('Could not load saved recordings. Close and reopen to retry.');
      setRecordings((await response.json()).recordings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load recordings.');
    } finally {
      setLoading(false);
    }
  }
  async function play(cacheKey: string) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/briefing/last', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orchardId, cacheKey }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('This saved recording is unavailable.');
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = URL.createObjectURL(await response.blob());
      setAudio(audioUrl.current);
      setSelected(cacheKey);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not play the recording.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <details
      className="saved-recordings"
      onToggle={(event) => {
        if (event.currentTarget.open && recordings === null && !loading) void load();
      }}
    >
      <summary>
        Earlier recordings <span>Saved briefings from this workspace</span>
      </summary>
      <p>
        These may describe an older work list. Check today’s instructions before starting. Replay
        never creates a new recording.
      </p>
      {loading && <p role="status">Loading…</p>}
      {recordings?.length === 0 && <p>No earlier recordings in this workspace.</p>}
      {recordings?.map((recording) => (
        <button
          key={recording.cacheKey}
          className="secondary"
          disabled={loading}
          onClick={() => play(recording.cacheKey)}
        >
          {selected === recording.cacheKey ? 'Loaded' : 'Open recording'} ·{' '}
          {new Date(recording.createdAt).toLocaleString()}
        </button>
      ))}
      {audio && <audio key={audio} controls src={audio} aria-label="Earlier saved briefing" />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
