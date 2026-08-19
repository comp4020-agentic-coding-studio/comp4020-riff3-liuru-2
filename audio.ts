// Small synthesized sound effects, one voice per station. Nothing is a
// recorded sample --- every sound here is generated on the fly with the Web
// Audio API, so the argument stays self-contained: the page hands you a
// phenomenon and a sound for it, and neither survives past its moment.

const STORAGE_KEY = "six-as-ifs-muted";
const MASTER_VOLUME = 0.5;

let ctx: AudioContext | undefined;
let masterGain: GainNode | undefined;
let muted = loadMutedPref();

function loadMutedPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMutedPref(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Private browsing or disabled storage --- the toggle just won't persist.
  }
}

function getContext(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const AudioCtor = window.AudioContext;
  if (!AudioCtor) return undefined;
  if (!ctx) {
    ctx = new AudioCtor();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  saveMutedPref(value);
  if (masterGain) masterGain.gain.value = value ? 0 : MASTER_VOLUME;
}

function envelope(gain: GainNode, context: AudioContext, attack: number, decay: number, peak: number): void {
  const t = context.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", peak = 0.6): void {
  const context = getContext();
  if (!context || !masterGain) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, context.currentTime);
  osc.connect(gain);
  gain.connect(masterGain);
  envelope(gain, context, 0.008, duration, peak);
  osc.start();
  osc.stop(context.currentTime + duration + 0.05);
}

function noiseBurst(
  duration: number,
  filterFreq: number,
  filterType: BiquadFilterType = "bandpass",
  q = 1,
  peak = 0.5,
): void {
  const context = getContext();
  if (!context || !masterGain) return;
  const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = q;

  const gain = context.createGain();
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  envelope(gain, context, 0.004, duration, peak);
  source.start();
}

// Dream --- a word settling into place, then a swap that shimmers past it.
export function playDreamReveal(): void {
  tone(520 + Math.random() * 60, 0.18, "sine", 0.25);
}

export function playDreamSwap(): void {
  const base = 380 + Math.random() * 260;
  tone(base, 0.32, "sine", 0.3);
  tone(base * 1.5, 0.28, "sine", 0.12);
}

export function playDreamDissolve(): void {
  noiseBurst(1.4, 900, "lowpass", 0.4, 0.3);
}

// Illusion --- a whoosh as the card turns to show nothing behind it.
export function playIllusionFlip(): void {
  const context = getContext();
  if (!context || !masterGain) return;
  const duration = 0.4;
  const bufferSize = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.5;
  const t = context.currentTime;
  filter.frequency.setValueAtTime(2200, t);
  filter.frequency.exponentialRampToValueAtTime(280, t + duration);

  const gain = context.createGain();
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  envelope(gain, context, 0.01, duration, 0.4);
  source.start();
}

// Bubble --- a soft rising pitch while it grows, then a pop that ends it.
let bubbleOsc: OscillatorNode | undefined;
let bubbleGain: GainNode | undefined;

export function startBubbleTone(): void {
  const context = getContext();
  if (!context || !masterGain) return;
  stopBubbleTone();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, context.currentTime);
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(0.12, context.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  bubbleOsc = osc;
  bubbleGain = gain;
}

export function updateBubbleTone(progress: number): void {
  const context = ctx;
  if (!context || !bubbleOsc) return;
  const freq = 220 + Math.min(1, Math.max(0, progress)) * 260;
  bubbleOsc.frequency.setTargetAtTime(freq, context.currentTime, 0.05);
}

export function stopBubbleTone(): void {
  if (!bubbleOsc || !bubbleGain || !ctx) {
    bubbleOsc = undefined;
    bubbleGain = undefined;
    return;
  }
  const context = ctx;
  const osc = bubbleOsc;
  const gain = bubbleGain;
  gain.gain.cancelScheduledValues(context.currentTime);
  gain.gain.setTargetAtTime(0, context.currentTime, 0.03);
  osc.stop(context.currentTime + 0.15);
  bubbleOsc = undefined;
  bubbleGain = undefined;
}

export function playBubblePop(): void {
  noiseBurst(0.08, 2600, "bandpass", 0.8, 0.4);
  tone(950, 0.05, "square", 0.15);
}

// Shadow --- a dull, muffled thud: there's nothing solid under the click.
export function playShadowThud(): void {
  const context = getContext();
  if (!context || !masterGain) return;
  const osc = context.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, context.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, context.currentTime + 0.22);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 260;
  const gain = context.createGain();
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  envelope(gain, context, 0.004, 0.25, 0.35);
  osc.start();
  osc.stop(context.currentTime + 0.3);
}

// Dew --- a droplet forming, a rattle that doesn't stop it, a fade at dawn.
export function playDewForm(): void {
  tone(1300, 0.16, "sine", 0.2);
}

export function playDewShake(): void {
  noiseBurst(0.05, 650, "bandpass", 4, 0.3);
  window.setTimeout(() => noiseBurst(0.05, 520, "bandpass", 4, 0.3), 70);
}

export function playDewEvaporate(): void {
  noiseBurst(0.7, 3200, "highpass", 0.4, 0.25);
}

// Lightning --- real field recordings: a sharp strike for the instant hit,
// a longer rolling one for the slow-motion replay.
const LIGHTNING_STRIKE_URL = new URL("./dragon-studio-lightning-strike-386161.mp3", import.meta.url).href;
const LIGHTNING_REPLAY_URL = new URL("./patricksilvey-weather-lightning-2-464187.mp3", import.meta.url).href;

function playClip(url: string, volume: number): void {
  if (muted) return;
  const clip = new Audio(url);
  clip.volume = volume;
  void clip.play().catch(() => {
    // Autoplay can be blocked before the first user gesture --- fine to drop.
  });
}

export function playLightningStrike(): void {
  playClip(LIGHTNING_STRIKE_URL, 0.9);
}

export function playLightningReplay(): void {
  playClip(LIGHTNING_REPLAY_URL, 0.85);
}
