// @vitest-environment node
import { describe, expect, it } from "vitest";
import { wavePath } from "./wave-path";

const OPTIONS = { radius: 0.9, wobble: 0.05, seed: 1, size: 360 } as const;

/** Every number in a path, in the order the path commands carry them. */
function pathNumbers(path: string): number[] {
  return [...path.matchAll(/-?\d+(?:\.\d+)?/gu)].map((match) => Number(match[0]));
}

describe("wavePath", () => {
  it("closes the loop so no seam shows where it meets its own start", () => {
    const path = wavePath(OPTIONS);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.endsWith(" Z")).toBe(true);
    // One `C` per vertex: the curve visits every point and returns to the first.
    expect(path.match(/C /gu)).toHaveLength(12);
  });

  it("draws the same outline for the same options, so a re-render does not jump", () => {
    expect(wavePath(OPTIONS)).toBe(wavePath(OPTIONS));
  });

  it("gives two rings of one plan two different shapes", () => {
    expect(wavePath({ ...OPTIONS, seed: 4.3 })).not.toBe(wavePath(OPTIONS));
  });

  it("stays inside the box it is drawn in", () => {
    for (const seed of [1, 4.3, 7.6]) {
      const numbers = pathNumbers(wavePath({ ...OPTIONS, seed, wobble: 0.12 }));
      // The path is `x y` pairs after the move and two control points per curve, all inside the box.
      for (const value of numbers) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(OPTIONS.size);
      }
    }
  });

  it("is never a plain circle", () => {
    const numbers = pathNumbers(wavePath(OPTIONS));
    const centre = OPTIONS.size / 2;
    const radii = numbers.slice(0, 2).length === 2 ? edgeRadii(numbers, centre) : [];
    expect(radii.length).toBeGreaterThan(1);
    // A circle would give every vertex the same distance from the centre.
    expect(new Set(radii.map((radius) => radius.toFixed(1))).size).toBeGreaterThan(1);
  });

  it("keeps the outline round enough to read as a ring: it is not a scribble", () => {
    const numbers = pathNumbers(wavePath({ ...OPTIONS, wobble: 0.12 }));
    const centre = OPTIONS.size / 2;
    const radii = edgeRadii(numbers, centre);
    const target = 0.9 * centre;
    for (const radius of radii) {
      // Within a third of the target radius: a ring with a bite out of it is not a wave.
      expect(Math.abs(radius - target)).toBeLessThan(target / 3);
    }
  });
});

/**
 * The distance of each on-curve vertex from the centre.
 *
 * A path is `M x y` then one `C c1x c1y c2x c2y x y` per vertex, so the on-curve point is the last
 * pair of each group: the numbers whose index is 2, then every sixth after.
 */
function edgeRadii(numbers: readonly number[], centre: number): number[] {
  const radii: number[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 6) {
    const x = numbers[index] ?? centre;
    const y = numbers[index + 1] ?? centre;
    radii.push(Math.hypot(x - centre, y - centre));
  }
  return radii;
}
