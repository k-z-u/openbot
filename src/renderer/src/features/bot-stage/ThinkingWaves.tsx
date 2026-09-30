import { For } from "solid-js";
import type { WavePlan } from "./bot-visual-state";
import { wavePath } from "./wave-path";

/**
 * The rings around the core, one SVG per layer.
 *
 * The outline is static and the movement is CSS: each layer is transformed and faded by keyframes
 * chosen from the plan's motion, which the compositor runs without waking the main thread. That is
 * the whole reason this is not a canvas - a canvas would have to redraw these few hundred bytes of
 * path sixty times a second to say the same thing.
 *
 * Each ring is drawn twice: the same path as a wide, faint stroke under a thin bright one. That is
 * the glow, and it is two vector strokes rather than a blur because a filter would re-rasterise the
 * whole halo on every frame of a heartbeat, while two strokes cost nothing to move.
 *
 * The geometry is written once per state change rather than per frame, and the phase of each layer
 * comes from its index through `--kz-layer`, so three rings drift out of step without three
 * hand-written animations.
 */
export function ThinkingWaves(props: { plan: WavePlan; size: number }) {
  return (
    <div class="kz-waves" aria-hidden="true" data-motion={props.plan.motion} data-layers={props.plan.layers.length}>
      <For each={props.plan.layers}>
        {(layer) => {
          const outline = () =>
            wavePath({
              radius: layer.radius,
              wobble: layer.wobble,
              points: layer.points,
              seed: layer.seed,
              size: props.size,
            });
          const layerStyle = () => `--kz-layer: ${layer.index}`;
          return (
            <svg class="kz-wave" viewBox={`0 0 ${props.size} ${props.size}`} aria-hidden="true" style={layerStyle()}>
              <path class="kz-wave-glow" data-layer={layer.index} d={outline()} />
              <path class="kz-wave-line" data-layer={layer.index} d={outline()} />
            </svg>
          );
        }}
      </For>
    </div>
  );
}
