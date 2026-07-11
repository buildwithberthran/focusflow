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

export function playBeepCountdown(seconds = 3) {
  try {
    const ctx = getAudioCtx();
    const startFreq = 660;
    const endFreq = 330;
    for (let i = 0; i < seconds; i++) {
      const f = seconds > 1 ? startFreq - ((startFreq - endFreq) * i) / (seconds - 1) : startFreq;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 1.0;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
    }
  } catch {
    /* ignore */
  }
}

function countdownPhrases(seconds: number): string[] {
  const out: string[] = [];
  for (let i = seconds; i >= 1; i--) out.push(String(i));
  return out;
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

export function announceBreakStart(
  alertSound: 'beep' | 'voice',
  n: number,
  sc: () => boolean,
  seconds = 3
): Promise<void> {
  if (alertSound === 'voice') {
    return speakSequence([`Circle ${n} complete.`, 'Beginning break in', ...countdownPhrases(seconds)], sc);
  }
  playBeep();
  return new Promise((res) => {
    setTimeout(() => {
      if (sc()) playBeepCountdown(seconds);
      setTimeout(res, seconds * 1000 + 200);
    }, 600);
  });
}

export function announceNextCycleStart(
  alertSound: 'beep' | 'voice',
  n: number,
  sc: () => boolean,
  seconds = 3
): Promise<void> {
  if (alertSound === 'voice') {
    return speakSequence([`Circle ${n} begins in`, ...countdownPhrases(seconds)], sc);
  }
  playBeepCountdown(seconds);
  return new Promise((res) => setTimeout(res, seconds * 1000 + 200));
}
