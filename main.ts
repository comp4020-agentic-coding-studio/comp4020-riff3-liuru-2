// Six stations, one mechanic: summon a phenomenon, then try to hold it. The
// shared #hold-count tally is what makes six unrelated toys read as one
// argument instead of six demos — every station only taxes it on the action
// that is actually an attempt to hold on, never on the action that summons
// the thing in the first place.

import {
  isMuted,
  playBubblePop,
  playDewEvaporate,
  playDewForm,
  playDewShake,
  playDreamDissolve,
  playDreamReveal,
  playDreamSwap,
  playIllusionFlip,
  playLightningReplay,
  playLightningStrike,
  playShadowThud,
  setMuted,
  startBubbleTone,
  stopBubbleTone,
  updateBubbleTone,
} from "./audio";

const holdCountEl = document.querySelector<HTMLElement>("#hold-count");
let holdCount = 0;

function tally(): void {
  holdCount += 1;
  if (holdCountEl) holdCountEl.textContent = String(holdCount);
}

const DREAM_WORDS = ["You", "are", "standing", "in", "a", "familiar", "room."];
const DREAM_SWAPS = [
  "water",
  "your",
  "childhood",
  "the",
  "ocean",
  "school",
  "nowhere",
  "static",
  "someone",
  "else's",
  "hallway",
];

function initDream(): void {
  const sentence = document.querySelector<HTMLElement>('[data-testid="dream-sentence"]');
  const startButton = document.querySelector<HTMLButtonElement>("#dream-start");
  const note = document.querySelector<HTMLElement>("#dream-note");
  const overlay = document.querySelector<HTMLElement>("#dream-overlay");
  if (!sentence || !startButton || !note || !overlay) return;
  const overlayEl = overlay;

  let dissolveTimer: number | undefined;
  const revealTimers: number[] = [];

  function swapWord(span: HTMLElement): void {
    tally();
    playDreamSwap();
    const replacement = DREAM_SWAPS[Math.floor(Math.random() * DREAM_SWAPS.length)] ?? "something else";
    span.textContent = replacement;
    span.classList.add("swapped");
  }

  function makeWordSpan(word: string): HTMLElement {
    const span = document.createElement("span");
    span.textContent = word;
    span.className = "dream-word";
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    span.setAttribute("aria-label", `Try to hold the word "${word}"`);
    span.addEventListener("click", () => swapWord(span));
    span.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        swapWord(span);
      }
    });
    return span;
  }

  startButton.addEventListener("click", () => {
    if (dissolveTimer) window.clearTimeout(dissolveTimer);
    for (const timer of revealTimers.splice(0)) window.clearTimeout(timer);
    sentence.replaceChildren();
    sentence.classList.remove("dissolved");
    overlayEl.classList.remove("active");
    note.textContent = "";
    startButton.disabled = true;

    for (const [index, word] of DREAM_WORDS.entries()) {
      revealTimers.push(
        window.setTimeout(() => {
          sentence.append(makeWordSpan(word), document.createTextNode(" "));
          playDreamReveal();
        }, index * 450),
      );
    }

    const totalReveal = DREAM_WORDS.length * 450;
    dissolveTimer = window.setTimeout(() => {
      sentence.classList.add("dissolved");
      overlayEl.classList.add("active");
      note.textContent = "The room dissolved. You were never holding it up.";
      startButton.disabled = false;
      playDreamDissolve();
    }, totalReveal + 2200);
  });
}

function initIllusion(): void {
  const card = document.querySelector<HTMLElement>("#illusion-card");
  const flipButton = document.querySelector<HTMLButtonElement>("#illusion-flip");
  const note = document.querySelector<HTMLElement>("#illusion-note");
  const sweep = document.querySelector<HTMLElement>("#illusion-sweep");
  if (!card || !flipButton || !note || !sweep) return;
  const sweepEl = sweep;

  let flipped = false;
  flipButton.addEventListener("click", () => {
    tally();
    playIllusionFlip();
    flipped = !flipped;
    card.classList.toggle("flipped", flipped);
    sweepEl.classList.remove("sweep");
    void sweepEl.offsetWidth;
    sweepEl.classList.add("sweep");
    note.textContent = flipped
      ? "The far side isn't there. It never needed one to look solid from here."
      : "From the front, it's convincing again.";
  });
}

const FIELD_BUBBLE_COUNT = 18;

function spawnFieldBubbles(field: HTMLElement): void {
  for (let i = 0; i < FIELD_BUBBLE_COUNT; i += 1) {
    const el = document.createElement("div");
    el.className = "field-bubble";
    const size = 0.8 + Math.random() * 2.6;
    const duration = 4 + Math.random() * 4;
    const delay = Math.random() * 1.8;
    el.style.left = `${Math.random() * 100}%`;
    el.style.width = `${size}rem`;
    el.style.height = `${size}rem`;
    el.style.animationDuration = `${duration}s`;
    el.style.animationDelay = `${delay}s`;
    el.addEventListener("animationend", () => el.remove());
    field.append(el);
  }
}

function initBubble(): void {
  const bubble = document.querySelector<HTMLElement>("#bubble");
  const blowButton = document.querySelector<HTMLButtonElement>("#bubble-blow");
  const note = document.querySelector<HTMLElement>("#bubble-note");
  const field = document.querySelector<HTMLElement>("#bubble-field");
  const popFlash = document.querySelector<HTMLElement>("#bubble-pop-flash");
  if (!bubble || !blowButton || !note || !field || !popFlash) return;
  const bubbleEl = bubble;
  const noteEl = note;
  const fieldEl = field;
  const popFlashEl = popFlash;

  let growTimer: number | undefined;
  let popAt = 0;
  let popped = false;

  function reset(): void {
    popped = false;
    bubbleEl.style.setProperty("--scale", "0");
    bubbleEl.classList.remove("popped");
    // Always pops within a couple of seconds — care and timing don't change that.
    popAt = 1200 + Math.random() * 1800;
  }

  function stopGrowing(): void {
    if (growTimer !== undefined) {
      window.clearInterval(growTimer);
      growTimer = undefined;
    }
  }

  function pop(): void {
    stopGrowing();
    stopBubbleTone();
    if (popped) return;
    popped = true;
    tally();
    playBubblePop();
    bubbleEl.classList.add("popped");
    popFlashEl.classList.remove("pop");
    void popFlashEl.offsetWidth;
    popFlashEl.classList.add("pop");
    noteEl.textContent = "However carefully you held it, it popped anyway.";
  }

  function startBlowing(): void {
    reset();
    startBubbleTone();
    spawnFieldBubbles(fieldEl);
    const start = performance.now();
    growTimer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const size = Math.min(1, elapsed / popAt);
      bubbleEl.style.setProperty("--scale", size.toFixed(3));
      updateBubbleTone(size);
      if (elapsed >= popAt) pop();
    }, 30);
  }

  blowButton.addEventListener("pointerdown", startBlowing);
  blowButton.addEventListener("pointerup", () => {
    if (!popped) pop();
  });
  blowButton.addEventListener("pointerleave", () => {
    if (!popped && growTimer !== undefined) pop();
  });
  blowButton.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat && growTimer === undefined) {
      event.preventDefault();
      startBlowing();
    }
  });
  blowButton.addEventListener("keyup", (event) => {
    if ((event.key === " " || event.key === "Enter") && !popped) {
      event.preventDefault();
      pop();
    }
  });
}

function initShadow(): void {
  const sun = document.querySelector<HTMLElement>("#sun");
  const cast = document.querySelector<HTMLElement>("#shadow-cast");
  const pageShadow = document.querySelector<HTMLElement>("#page-shadow");
  const note = document.querySelector<HTMLElement>("#shadow-note");
  if (!sun || !cast || !pageShadow || !note) return;
  const sunEl = sun;
  const castEl = cast;
  const pageShadowEl = pageShadow;
  const noteEl = note;

  let lightX = 20;
  const STEP = 4;
  const MIN = 2;
  const MAX = 98;

  function render(): void {
    sunEl.style.left = `${lightX}%`;
    sunEl.setAttribute("aria-valuenow", String(Math.round(lightX)));
    const offset = (50 - lightX) * 1.1;
    castEl.style.transform = `translateX(${offset}%)`;
    // The page-wide shadow falls opposite the sun, clamped so its wide
    // shape never runs fully off either edge.
    const pageX = Math.min(88, Math.max(12, 100 - lightX));
    pageShadowEl.style.left = `${pageX}%`;
  }

  function moveSun(delta: number): void {
    lightX = Math.min(MAX, Math.max(MIN, lightX + delta));
    render();
  }

  function updateFromPointer(event: PointerEvent): void {
    const percent = (event.clientX / window.innerWidth) * 100;
    lightX = Math.min(MAX, Math.max(MIN, percent));
    render();
  }

  sunEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      moveSun(-STEP);
      event.preventDefault();
    }
    if (event.key === "ArrowRight") {
      moveSun(STEP);
      event.preventDefault();
    }
  });

  let dragging = false;
  sunEl.addEventListener("pointerdown", (event) => {
    dragging = true;
    sunEl.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  window.addEventListener("pointermove", (event) => {
    if (dragging) updateFromPointer(event);
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
  });

  function reveal(): void {
    tally();
    playShadowThud();
    noteEl.textContent = "Nothing there. It's just where the light doesn't reach.";
    pageShadowEl.classList.remove("revealed");
    void pageShadowEl.offsetWidth;
    pageShadowEl.classList.add("revealed");
  }

  castEl.addEventListener("click", reveal);
  castEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      reveal();
    }
  });
  pageShadowEl.addEventListener("click", reveal);
  pageShadowEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      reveal();
    }
  });

  render();
}

function initDew(): void {
  const drop = document.querySelector<HTMLElement>("#dew-drop");
  const formButton = document.querySelector<HTMLButtonElement>("#dew-form");
  const freezeButton = document.querySelector<HTMLButtonElement>("#dew-freeze");
  const note = document.querySelector<HTMLElement>("#dew-note");
  const mist = document.querySelector<HTMLElement>("#dew-mist");
  if (!drop || !formButton || !freezeButton || !note || !mist) return;
  const mistEl = mist;

  const LIFETIME_MS = 6000;
  let evaporateTimer: number | undefined;

  formButton.addEventListener("click", () => {
    if (evaporateTimer !== undefined) window.clearTimeout(evaporateTimer);
    drop.classList.remove("evaporated");
    drop.classList.add("forming");
    mistEl.classList.add("active");
    freezeButton.disabled = false;
    formButton.disabled = true;
    note.textContent = "Forming. It has until sunrise, whether you watch or not.";
    playDewForm();

    evaporateTimer = window.setTimeout(() => {
      drop.classList.remove("forming");
      drop.classList.add("evaporated");
      mistEl.classList.remove("active");
      note.textContent = "Gone. Freezing it wasn't ever an option this page offered.";
      freezeButton.disabled = true;
      formButton.disabled = false;
      playDewEvaporate();
    }, LIFETIME_MS);
  });

  freezeButton.addEventListener("click", () => {
    tally();
    playDewShake();
    drop.classList.add("shaken");
    window.setTimeout(() => drop.classList.remove("shaken"), 300);
    note.textContent = "It kept going. This button was always cosmetic.";
  });
}

// Builds a jagged N-point path down the page, in the 0-100 viewBox units
// that #lightning-bolt's SVG stretches to the full viewport.
function boltPoints(startX: number, startY: number, endY: number, segments: number, spread: number): string {
  const points: string[] = [`${startX},${startY}`];
  let x = startX;
  const stepY = (endY - startY) / segments;
  for (let i = 1; i <= segments; i += 1) {
    x += (Math.random() - 0.5) * spread;
    x = Math.min(96, Math.max(4, x));
    const y = startY + stepY * i;
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

function drawBolt(polyline: SVGPolylineElement, points: string, durationMs: number): void {
  polyline.setAttribute("points", points);
  const length = polyline.getTotalLength();
  polyline.style.transition = "none";
  polyline.style.strokeDasharray = `${length}`;
  polyline.style.strokeDashoffset = `${length}`;
  void polyline.getBoundingClientRect();
  requestAnimationFrame(() => {
    polyline.style.transition = `stroke-dashoffset ${durationMs}ms ease-out`;
    polyline.style.strokeDashoffset = "0";
  });
}

function initLightning(): void {
  const stage = document.querySelector<HTMLElement>("#lightning-stage");
  const overlay = document.querySelector<HTMLElement>("#lightning-overlay");
  const bolt = document.querySelector<HTMLElement>("#lightning-bolt");
  const boltMain = document.querySelector<SVGPolylineElement>("#lightning-bolt-main");
  const boltBranch = document.querySelector<SVGPolylineElement>("#lightning-bolt-branch");
  const strikeButton = document.querySelector<HTMLButtonElement>("#lightning-strike");
  const replayButton = document.querySelector<HTMLButtonElement>("#lightning-replay");
  const note = document.querySelector<HTMLElement>("#lightning-note");
  if (!stage || !overlay || !bolt || !boltMain || !boltBranch || !strikeButton || !replayButton || !note) return;
  const stageEl = stage;
  const overlayEl = overlay;
  const boltEl = bolt;
  const boltMainEl = boltMain;
  const boltBranchEl = boltBranch;
  const noteEl = note;
  const replayButtonEl = replayButton;

  function flash(slow: boolean): void {
    stageEl.classList.remove("flash", "flash-slow");
    overlayEl.classList.remove("flash", "flash-slow");
    boltEl.classList.remove("strike", "flash-slow");
    // Force a reflow so re-adding the class restarts the animation.
    void stageEl.offsetWidth;
    const flashClass = slow ? "flash-slow" : "flash";
    stageEl.classList.add(flashClass);
    overlayEl.classList.add(flashClass);
    boltEl.classList.add(slow ? "flash-slow" : "strike");

    const startX = 30 + Math.random() * 40;
    const groundY = 60 + Math.random() * 25;
    const drawMs = slow ? 1100 : 140;
    drawBolt(boltMainEl, boltPoints(startX, 0, groundY, 7, 14), drawMs);

    const forkAt = 0.35 + Math.random() * 0.25;
    const forkStartY = groundY * forkAt;
    const forkStartX = startX + (Math.random() - 0.5) * 6;
    drawBolt(
      boltBranchEl,
      boltPoints(forkStartX, forkStartY, forkStartY + (groundY - forkStartY) * 0.6, 4, 18),
      drawMs,
    );

    if (slow) playLightningReplay();
    else playLightningStrike();
    noteEl.textContent = slow
      ? "Stretched to a second and a half. Still nothing in the middle to hold onto."
      : "That took under a fifth of a second. Hit replay to look slower.";
    replayButtonEl.disabled = false;
  }

  strikeButton.addEventListener("click", () => flash(false));
  replayButton.addEventListener("click", () => {
    tally();
    flash(true);
  });
}

function initSoundToggle(): void {
  const button = document.querySelector<HTMLButtonElement>("#sound-toggle");
  if (!button) return;
  const buttonEl = button;

  function render(): void {
    const muted = isMuted();
    buttonEl.setAttribute("aria-pressed", String(!muted));
    buttonEl.replaceChildren();
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = muted ? "🔇" : "🔊";
    buttonEl.append(icon, document.createTextNode(muted ? " Sound off" : " Sound on"));
  }

  buttonEl.addEventListener("click", () => {
    setMuted(!isMuted());
    render();
  });

  render();
}

initDream();
initIllusion();
initBubble();
initShadow();
initDew();
initLightning();
initSoundToggle();

import { initTrails } from "./trails";

const trailsCanvas = document.querySelector<HTMLCanvasElement>("[data-trails]");
if (trailsCanvas) initTrails(trailsCanvas);
