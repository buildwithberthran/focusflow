/**
 * Formats a whole-second duration as an exact clock string — never rounds.
 * Under an hour:  MM:SS   (e.g. "00:53", "01:53")
 * An hour or more: HH:MM:SS (e.g. "01:59:00")
 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/**
 * Formats a whole-second duration as a compact human string for read-only
 * contexts (e.g. History) — still exact, never rounds to the nearest minute.
 * Examples: "42s", "1m 04s", "1h 04m 12s"
 */
export function formatDurationExact(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}
