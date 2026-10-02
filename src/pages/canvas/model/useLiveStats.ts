import { useEffect, useState } from 'react';

const CHANNEL = 'cameo-live-stats';
const HEARTBEAT_MS = 2000;
const STALE_MS = 6000;

type Presence = {
  type: 'here';
  id: string;
  at: number;
  committed: boolean;
};

const isPresence = (value: unknown): value is Presence => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Presence;
  return row.type === 'here' && typeof row.id === 'string' && typeof row.committed === 'boolean';
};

export function useLiveStats(committed: boolean) {
  const [users, setUsers] = useState(1);
  const [strokes, setStrokes] = useState(committed ? 1 : 0);
  const [id] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cameo-${Math.random().toString(16).slice(2)}`
  );

  useEffect(() => {
    const seen = new Map<string, { at: number; committed: boolean }>();
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

    const tally = () => {
      const now = Date.now();
      for (const [id, row] of seen) if (now - row.at > STALE_MS) seen.delete(id);
      seen.set(id, { at: now, committed });
      let nextStrokes = 0;
      for (const row of seen.values()) if (row.committed) nextStrokes += 1;
      setUsers(seen.size);
      setStrokes(nextStrokes);
    };

    const publish = () => {
      const payload: Presence = {
        type: 'here',
        id: id,
        at: Date.now(),
        committed,
      };
      channel?.postMessage(payload);
      tally();
    };

    if (channel) {
      channel.onmessage = event => {
        if (!isPresence(event.data)) return;
        seen.set(event.data.id, { at: Date.now(), committed: event.data.committed });
        tally();
      };
    }

    publish();
    const beat = window.setInterval(publish, HEARTBEAT_MS);
    return () => {
      window.clearInterval(beat);
      channel?.close();
    };
  }, [committed, id]);

  return { users, strokes };
}
