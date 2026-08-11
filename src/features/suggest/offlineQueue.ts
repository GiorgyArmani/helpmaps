import { storageKey } from "@/config";

/**
 * Offline-first queue for public submissions.
 *
 * Ported from the original app's intake queue. The reason it exists: someone standing
 * in front of a shelter, on one bar of signal, taps send — and the request fails. Losing
 * what they typed there means losing the only person who was going to report that point.
 * So the submission is written to localStorage first and retried when the connection
 * comes back.
 *
 * Nothing here touches the database: it replays the same public endpoint the form uses.
 */

export interface QueuedSubmission {
  id: string;
  createdAt: string;
  kind: string;
  message: string;
  name: string | null;
  contact: string | null;
}

const KEY = storageKey("suggest-queue:v1");

function read(): QueuedSubmission[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as QueuedSubmission[]) : [];
  } catch {
    return [];
  }
}

function write(list: QueuedSubmission[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full — non-fatal, the item is simply not retried */
  }
}

export function queueCount(): number {
  return read().length;
}

export function enqueue(sub: Omit<QueuedSubmission, "id" | "createdAt">): void {
  const list = read();
  list.push({
    ...sub,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });
  write(list);
}

async function send(sub: QueuedSubmission): Promise<"sent" | "drop" | "keep"> {
  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: sub.kind,
        message: sub.message,
        name: sub.name,
        contact: sub.contact,
      }),
    });
    if (res.ok) return "sent";
    // 429 is temporary — the limiter, not the payload. Keep it for the next round.
    if (res.status === 429) return "keep";
    // Other 4xx means this body will never be accepted; retrying forever would just
    // block everything behind it in the queue.
    if (res.status >= 400 && res.status < 500) return "drop";
    return "keep";
  } catch {
    // Offline: keep and retry later.
    return "keep";
  }
}

export interface FlushResult {
  sent: number;
  dropped: number;
  remaining: number;
}

let flushing = false;

/**
 * Try to send everything queued. Stops at the first item that has to be kept (offline,
 * or rate-limited) rather than hammering a network that is already struggling; the rest
 * are retried on the next trigger.
 */
export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return { sent: 0, dropped: 0, remaining: queueCount() };
  flushing = true;
  let sent = 0;
  let dropped = 0;
  try {
    let list = read();
    while (list.length) {
      const item = list[0];
      if (!item) break;
      const result = await send(item);
      if (result === "keep") break;
      if (result === "sent") sent++;
      if (result === "drop") dropped++;
      list = read().filter((x) => x.id !== item.id);
      write(list);
    }
    return { sent, dropped, remaining: read().length };
  } finally {
    flushing = false;
  }
}

/** Retry when the connection returns, and once at startup. Returns an unsubscribe. */
export function watchConnection(): () => void {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => void flushQueue();
  window.addEventListener("online", onOnline);
  if (navigator.onLine) void flushQueue();
  return () => window.removeEventListener("online", onOnline);
}
