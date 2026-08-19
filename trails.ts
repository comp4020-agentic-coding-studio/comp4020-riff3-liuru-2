// A pointer-following spring trail, drawn on a full-viewport 2D canvas.
//
// Each "line" is a chain of nodes: the head is sprung toward the pointer, and
// every node after it is sprung toward the node ahead of it, so the chain lags
// and whips. Stroking all of them with a very low alpha under `lighter`
// compositing is what produces the bloom — no single stroke is visible on its
// own; the brightness is the overlap.
//
// Everything here is decorative. The canvas never takes pointer events, the
// animation never starts when the OS asks for reduced motion, and it stops
// entirely while the tab is hidden.

interface TrailNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface TrailLine {
  spring: number;
  friction: number;
  nodes: TrailNode[];
}

export interface TrailsHandle {
  destroy: () => void;
}

const NODES_PER_LINE = 50;
const LINES_WIDE = 80;
const LINES_NARROW = 30;
// Below this viewport width we run a third of the lines: the trail reads the
// same at phone size, and the per-frame cost is what actually matters there.
const NARROW_WIDTH = 700;

const BASE_SPRING = 0.45;
const SPRING_SPREAD = 0.025;
const SPRING_JITTER = 0.05;
const BASE_FRICTION = 0.5;
const FRICTION_JITTER = 0.005;
const DAMPENING = 0.025;
// Each node down the chain is sprung slightly less tightly than the one before
// it, which is what makes the tail trail rather than snap.
const TENSION = 0.99;

const HUE_OFFSET = 285;
const HUE_AMPLITUDE = 85;
const HUE_FREQUENCY = 0.0015;

const LINE_WIDTH = 10;
const STROKE_ALPHA = 0.025;

export function initTrails(canvas: HTMLCanvasElement): TrailsHandle {
  const maybeCtx = canvas.getContext("2d");
  // A 2D context can genuinely be null (no GPU, too many live contexts). There
  // is nothing to degrade to for a decorative layer, so hand back an inert
  // handle rather than throwing on a page that is otherwise fine.
  if (!maybeCtx) return { destroy: () => undefined };
  // Re-bound so the hoisted function declarations below see the narrowed type.
  const ctx = maybeCtx;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: 0, y: 0 };

  let lines: TrailLine[] = [];
  let frame: number | undefined;
  // Random start phase so two tabs (or a reload) don't come up the same colour.
  let huePhase = Math.random() * Math.PI * 2;
  // Canvas dimensions in CSS pixels. The backing store is dpr times bigger, but
  // the transform means every drawing call below is in CSS pixels.
  let viewWidth = 0;
  let viewHeight = 0;

  function buildLines(): void {
    const total = window.innerWidth < NARROW_WIDTH ? LINES_NARROW : LINES_WIDE;
    lines = [];

    for (let i = 0; i < total; i += 1) {
      const nodes: TrailNode[] = [];
      for (let n = 0; n < NODES_PER_LINE; n += 1) {
        nodes.push({ x: pointer.x, y: pointer.y, vx: 0, vy: 0 });
      }

      lines.push({
        // Spread the springs across the fleet so the lines separate instead of
        // moving as one ribbon, then jitter each one off its slot.
        spring:
          BASE_SPRING +
          (i / total) * SPRING_SPREAD +
          Math.random() * SPRING_JITTER * 2 -
          SPRING_JITTER,
        friction:
          BASE_FRICTION + Math.random() * FRICTION_JITTER * 2 - FRICTION_JITTER,
        nodes,
      });
    }
  }

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    viewWidth = rect.width;
    viewHeight = rect.height;
    // Without this the canvas is stretched from a CSS-pixel backing store and
    // looks soft on any HiDPI screen.
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    // Assigning width/height resets the context state, so the transform has to
    // be re-applied after, not before.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildLines();
  }

  function updateLine(line: TrailLine): void {
    let spring = line.spring;
    const head = line.nodes[0];

    head.vx += (pointer.x - head.x) * spring;
    head.vy += (pointer.y - head.y) * spring;

    for (let i = 0; i < line.nodes.length; i += 1) {
      const node = line.nodes[i];

      if (i > 0) {
        const prev = line.nodes[i - 1];
        node.vx += (prev.x - node.x) * spring;
        node.vy += (prev.y - node.y) * spring;
        node.vx += prev.vx * DAMPENING;
        node.vy += prev.vy * DAMPENING;
      }

      node.vx *= line.friction;
      node.vy *= line.friction;
      node.x += node.vx;
      node.y += node.vy;

      spring *= TENSION;
    }
  }

  function strokeLine(line: TrailLine): void {
    const { nodes } = line;

    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);

    // Draw through the midpoint of each pair of nodes, using the node itself as
    // the control point — the standard trick for turning a polyline into a
    // smooth curve without solving for real spline control points.
    let i = 1;
    for (; i < nodes.length - 2; i += 1) {
      const node = nodes[i];
      const next = nodes[i + 1];
      ctx.quadraticCurveTo(node.x, node.y, (node.x + next.x) * 0.5, (node.y + next.y) * 0.5);
    }

    const node = nodes[i];
    const next = nodes[i + 1];
    ctx.quadraticCurveTo(node.x, node.y, next.x, next.y);
    ctx.stroke();
  }

  function render(): void {
    huePhase += HUE_FREQUENCY;
    const hue = Math.round(HUE_OFFSET + Math.cos(huePhase) * HUE_AMPLITUDE);

    ctx.clearRect(0, 0, viewWidth, viewHeight);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${STROKE_ALPHA})`;
    ctx.lineWidth = LINE_WIDTH;

    for (const line of lines) {
      updateLine(line);
      strokeLine(line);
    }

    frame = window.requestAnimationFrame(render);
  }

  function start(): void {
    if (frame !== undefined || reduceMotion.matches) return;
    frame = window.requestAnimationFrame(render);
  }

  function stop(): void {
    if (frame === undefined) return;
    window.cancelAnimationFrame(frame);
    frame = undefined;
  }

  function setPointer(clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    pointer.x = clientX - rect.left;
    pointer.y = clientY - rect.top;
  }

  function onMouseMove(event: MouseEvent): void {
    setPointer(event.clientX, event.clientY);
  }

  function onTouch(event: TouchEvent): void {
    const touch = event.touches[0];
    if (touch) setPointer(touch.clientX, touch.clientY);
  }

  function onResize(): void {
    resize();
  }

  function onVisibilityChange(): void {
    if (document.hidden) stop();
    else start();
  }

  // Listening on document rather than the canvas: the canvas is
  // pointer-events: none, so it never sees a pointer event itself.
  document.addEventListener("mousemove", onMouseMove, { passive: true });
  document.addEventListener("touchmove", onTouch, { passive: true });
  document.addEventListener("touchstart", onTouch, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);

  resize();
  // Start the chains at the centre so they settle there instead of streaming in
  // from the top-left corner before the pointer has ever moved.
  pointer.x = viewWidth / 2;
  pointer.y = viewHeight / 2;
  for (const line of lines) {
    for (const node of line.nodes) {
      node.x = pointer.x;
      node.y = pointer.y;
    }
  }

  start();

  return {
    destroy(): void {
      stop();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("touchmove", onTouch);
      document.removeEventListener("touchstart", onTouch);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ctx.clearRect(0, 0, viewWidth, viewHeight);
    },
  };
}
