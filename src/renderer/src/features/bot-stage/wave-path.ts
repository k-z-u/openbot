// The outline of one thinking ring.
//
// A plain circle reads as a progress spinner, so each ring is a closed loop whose radius wanders
// with three sine harmonics. The harmonics are whole multiples of the angle, which is what lets the
// loop close without a seam: a wave whose period did not divide the turn would jump when it met its
// own start. The seed shifts the harmonics' phase, so two rings of the same size are still two
// different shapes.
//
// This is deliberately the plainest thing that works: static `d`, no per-frame JavaScript, and the
// movement lives in CSS as transform and opacity. A path rebuilt every frame would spend the main
// thread's whole frame budget on a decoration.

/** Vertices in one outline. Twelve reads as organic and keeps the path a few hundred bytes. */
const DEFAULT_POINTS = 12;

function radiusAt(options: {
  angle: number;
  seed: number;
  radius: number;
  wobble: number;
  /** A second, slower wander, so the outline is not a single clean ripple. */
  longWobble: number;
}): number {
  const { angle, seed, radius, wobble, longWobble } = options;
  const ripple =
    Math.sin(angle * 2 + seed * 1.7) * 0.55 +
    Math.sin(angle * 3 - seed * 2.3) * 0.3 +
    Math.sin(angle * 5 + seed * 0.9) * 0.15;
  return radius * (1 + wobble * ripple + longWobble * Math.sin(angle + seed * 0.7));
}

/**
 * A closed cubic path through `points` vertices on a wandering circle, in a `size`-square box.
 *
 * The curve is the Catmull-Rom form written as beziers: each vertex's control points come from its
 * neighbours, which is what keeps the loop smooth through the jitter instead of faceted.
 */
export function wavePath(options: {
  /** Radius as a fraction of the box's half, before the wander. */
  radius: number;
  /** How far the outline wanders, as a fraction of that radius. */
  wobble: number;
  seed: number;
  size: number;
  points?: number;
}): string {
  const points = options.points ?? DEFAULT_POINTS;
  const centre = options.size / 2;
  const base = options.radius * centre;
  const vertices = Array.from({ length: points }, (_unused, index) => {
    const angle = (index / points) * Math.PI * 2 - Math.PI / 2;
    const radius = radiusAt({
      angle,
      seed: options.seed,
      radius: base,
      wobble: options.wobble,
      // The inner rings wander less than the outer ones, proportionally, so the outline stays
      // inside the halo box at three rings as well as at one.
      longWobble: options.wobble * 0.35,
    });
    return { x: centre + Math.cos(angle) * radius, y: centre + Math.sin(angle) * radius };
  });
  const first = vertexAt(vertices, 0, centre);
  return `${moveTo(first)} ${vertices.map((_vertex, index) => bezierSegment(vertices, index, centre)).join(" ")} Z`;
}

interface Vertex {
  x: number;
  y: number;
}

/**
 * One vertex of a closed loop, by index.
 *
 * The loop wraps in both directions, so a caller asking for `-1` or for one past the end gets the
 * vertex it means rather than nothing. The centre is the answer to an empty list, which the point
 * count makes impossible: it keeps a degenerate input a plain circle rather than a crash.
 */
function vertexAt(vertices: readonly Vertex[], index: number, centre: number): Vertex {
  const count = vertices.length;
  return vertices[((index % count) + count) % count] ?? { x: centre, y: centre };
}

function moveTo(vertex: Vertex): string {
  return `M ${round(vertex.x)} ${round(vertex.y)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** One vertex and the curve that leaves it, for a point list that wraps at both ends. */
function bezierSegment(vertices: readonly Vertex[], index: number, centre: number): string {
  const previous = vertexAt(vertices, index - 1, centre);
  const current = vertexAt(vertices, index, centre);
  const next = vertexAt(vertices, index + 1, centre);
  const afterNext = vertexAt(vertices, index + 2, centre);
  const firstControl = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
  const secondControl = { x: next.x - (afterNext.x - current.x) / 6, y: next.y - (afterNext.y - current.y) / 6 };
  return `C ${round(firstControl.x)} ${round(firstControl.y)} ${round(secondControl.x)} ${round(secondControl.y)} ${round(next.x)} ${round(next.y)}`;
}
