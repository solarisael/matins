const GLYPHS = "⟐◇⋮∴ΛΣϟ⌁";
const STEP_MS = 45;
const STEPS = 8;

const cache_hover = (cache) => {
  cache.frames.length = 0;
  for (let step = 0; step < STEPS; step++) {
    const previous = cache.frames[step - 1];
    cache.frames.push(
      cache.letters.map((letter, index) => {
        if (
          /\s/u.test(letter) ||
          index < Math.floor((step / STEPS) * cache.letters.length)
        )
          return letter;
        cache.seed ^= cache.seed << 13;
        cache.seed ^= cache.seed >>> 17;
        cache.seed ^= cache.seed << 5;
        let total = 0;
        for (let glyph = 0; glyph < GLYPHS.length; glyph++) {
          if (GLYPHS[glyph] !== previous?.[index])
            total += cache.weights[glyph];
        }
        let pick = ((cache.seed >>> 0) / 4294967296) * total;
        let selected = GLYPHS.length - 1;
        for (let glyph = 0; glyph < GLYPHS.length; glyph++) {
          if (GLYPHS[glyph] === previous?.[index]) continue;
          pick -= cache.weights[glyph];
          if (pick < 0) {
            selected = glyph;
            break;
          }
        }
        for (let glyph = 0; glyph < GLYPHS.length; glyph++) {
          cache.weights[glyph] =
            glyph === selected ? 0.2 : Math.min(1, cache.weights[glyph] + 0.15);
        }
        return GLYPHS[selected];
      }),
    );
  }
  return cache.frames.map((frame) => frame.join(""));
};

export const create_inscription = (
  label,
  { trigger = label, is_enabled = () => true, prepare_label = () => {} } = {},
) => {
  let disposed = false;
  let restore_layout;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const original = label.textContent;
  const cache = {
    letters: [...original],
    seed: crypto.getRandomValues(new Uint32Array(1))[0] || 1,
    weights: Array(GLYPHS.length).fill(1),
    frames: [],
    animation: null,
  };
  const restore = () => {
    if (cache.animation) cancelAnimationFrame(cache.animation.frame);
    cache.animation = null;
    label.textContent = original;
    restore_layout?.();
    restore_layout = null;
  };
  const enabled = () =>
    !disposed && !document.hidden && !motion.matches && is_enabled();
  const reveal = () => {
    if (!enabled() || cache.animation) return;
    restore_layout = prepare_label(label, original);
    const frames = cache_hover(cache);
    const start = performance.now();
    const animation = { frame: 0 };
    cache.animation = animation;
    let last_step = -1;
    const tick = (now) => {
      if (cache.animation !== animation) return;
      const step = Math.floor((now - start) / STEP_MS);
      if (!enabled() || step >= STEPS) {
        restore();
        return;
      }
      if (step !== last_step) {
        label.textContent = frames[step];
        last_step = step;
      }
      animation.frame = requestAnimationFrame(tick);
    };
    animation.frame = requestAnimationFrame(tick);
  };
  const on_selection = (event) => {
    if (event.type === "pointerover" && trigger.contains(event.relatedTarget))
      return;
    reveal();
  };
  const on_visibility = () => {
    if (document.hidden) restore();
  };
  const on_motion = () => {
    if (motion.matches) restore();
  };
  trigger.addEventListener("pointerover", on_selection);
  trigger.addEventListener("focusin", on_selection);
  document.addEventListener("visibilitychange", on_visibility);
  motion.addEventListener("change", on_motion);
  return {
    reveal,
    restore,
    dispose() {
      disposed = true;
      restore();
      trigger.removeEventListener("pointerover", on_selection);
      trigger.removeEventListener("focusin", on_selection);
      document.removeEventListener("visibilitychange", on_visibility);
      motion.removeEventListener("change", on_motion);
    },
  };
};
