let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function playBeep() {
  try {
    const ctx = getAudioCtx();
    [0, 0.45].forEach((d) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + d;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch {
    /* ignore */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function playEndingSoonTone() {
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 990;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.start(t);
    o.stop(t + 0.2);
  } catch {
    /* ignore */
  }
}

// Fired once per second while a cycle is in its final "ending soon" window —
// deliberately NOT awaited by the caller. Each cue is a single short word or
// tone that finishes well within a second, so it stays locked to the real
// per-second countdown instead of drifting behind it. (The old version spoke
// one full sentence — "5 seconds left" — a single time; by the time speech
// synthesis finished saying it, several real seconds had already ticked by,
// which is exactly the "sounds late" bug this replaces.)
export function cueEndingSoon(alertSound: 'beep' | 'voice', remaining: number, isFirst: boolean, label: string) {
  if (alertSound === 'voice') {
    // Each cue must interrupt, never queue. speakPhrase() alone doesn't cancel
    // a prior utterance, and a longer first phrase ("Cycle 1 ending in 5")
    // can easily take longer than a second to say — without cancelling here,
    // every subsequent per-second call queues up behind it instead of
    // replacing it, and the whole countdown falls further behind every tick
    // until it's still finishing "5" after the cycle has already ended.
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const phrase = isFirst ? `${label} ending in ${remaining}` : String(remaining);
    void speakPhrase(phrase);
    return;
  }
  playEndingSoonTone();
}

function playSingleCountdownTone(index: number, total: number) {
  try {
    const ctx = getAudioCtx();
    const startFreq = 660;
    const endFreq = 330;
    const f = total > 1 ? startFreq - ((startFreq - endFreq) * index) / (total - 1) : startFreq;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.start(t);
    o.stop(t + 0.4);
  } catch {
    /* ignore */
  }
}

type OnTick = (remaining: number) => void;

// Runs the "N, N-1, ... 1" countdown, calling onTick right as each number is
// cued (voice: just before speaking it; beep: just before the tone) so a
// caller can drive a UI countdown that's actually in lockstep with the audio,
// instead of guessing at timing separately. seconds <= 0 skips it entirely
// (an instant, no-countdown transition).
async function runCountdownTicks(
  alertSound: 'beep' | 'voice',
  seconds: number,
  onTick: OnTick,
  sc: () => boolean
): Promise<void> {
  if (seconds <= 0) return;
  for (let n = seconds; n >= 1; n--) {
    if (!sc()) return;
    onTick(n);
    if (alertSound === 'voice') {
      await speakPhrase(String(n));
    } else {
      playSingleCountdownTone(seconds - n, seconds);
      await sleep(1000);
    }
  }
}

function speakPhrase(text: string): Promise<void> {
  return new Promise((res) => {
    if (!('speechSynthesis' in window)) {
      res();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.onend = () => res();
    u.onerror = () => res();
    window.speechSynthesis.speak(u);
  });
}

export async function speakSequence(phrases: string[], shouldContinue: () => boolean) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  for (const p of phrases) {
    if (!shouldContinue()) break;
    await speakPhrase(p);
  }
}

export function cancelSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function announceBreakStart(
  alertSound: 'beep' | 'voice',
  n: number,
  sc: () => boolean,
  seconds = 3,
  onTick: OnTick = () => {}
): Promise<void> {
  if (!sc()) return;
  if (alertSound === 'voice') {
    const phrases = seconds > 0 ? [`Circle ${n} complete.`, 'Beginning break in'] : [`Circle ${n} complete.`];
    await speakSequence(phrases, sc);
  } else {
    playBeep();
    await sleep(600);
  }
  await runCountdownTicks(alertSound, seconds, onTick, sc);
}

export async function announceNextCycleStart(
  alertSound: 'beep' | 'voice',
  n: number,
  sc: () => boolean,
  seconds = 3,
  onTick: OnTick = () => {}
): Promise<void> {
  if (!sc()) return;
  if (alertSound === 'voice' && seconds > 0) {
    await speakSequence([`Circle ${n} begins in`], sc);
  }
  await runCountdownTicks(alertSound, seconds, onTick, sc);
}
