const EVENT_NAME = 'focusflow:recoverable-changed';

// Same-tab pub-sub. localStorage/'storage' events (used elsewhere for
// cross-tab sync) only fire in *other* tabs, never the one that made the
// change — so ending a session on the Recover page never notified that same
// tab's sidebar badge, which is why it looked stale until a manual refresh.
export function notifyRecoverableChanged() {
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function onRecoverableChanged(handler: () => void): () => void {
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
