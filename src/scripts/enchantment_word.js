import { create_enchanted_glyph } from "./enchantment_glyphs.js";
import { create_bleed_trail } from "./enchantment_bleed.js";

const create_letters = (text, overlay, bleed) => {
  const letters = [];
  let offset = 0;
  for (const character of text) {
    const start = offset;
    offset += character.length;
    if (/\s/u.test(character)) continue;
    const actor = document.createElement("span");
    actor.className = "sol__gather_glyph";
    const rune = create_enchanted_glyph();
    const letter = document.createElement("span");
    letter.className = "sol__gather_letter";
    letter.textContent = character;
    actor.append(rune, letter);
    overlay.append(actor);
    const motes = bleed.add();
    letters.push({ start, end: offset, actor, rune, letter, motes });
  }
  return letters;
};

const place_letters = (label, text, letters, overlay, bleed) => {
  const probe = label.cloneNode(false);
  probe.removeAttribute("id");
  probe.textContent = text;
  probe.style.cssText =
    "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:pre";
  label.parentElement.append(probe);
  try {
    const origin = overlay.getBoundingClientRect();
    const style = getComputedStyle(label);
    overlay.style.fontSize = style.fontSize;
    const range = document.createRange();
    for (const item of letters) {
      range.setStart(probe.firstChild, item.start);
      range.setEnd(probe.firstChild, item.end);
      const box = range.getBoundingClientRect();
      const left = `${box.left - origin.left + box.width / 2}px`;
      const top = `${box.top - origin.top + box.height / 2}px`;
      item.actor.style.left = left;
      item.actor.style.top = top;
      bleed.place(item.motes, {
        left: box.left - origin.left,
        top: box.top - origin.top,
        width: box.width,
        height: box.height,
      });
      item.letter.style.fontFamily = style.fontFamily;
      item.letter.style.textTransform = style.textTransform;
    }
  } finally {
    probe.remove();
  }
};

const gather_letter = (item, index, delay) => {
  const x = (Math.random() - 0.5) * 150;
  const y = (Math.random() - 0.65) * 100;
  const options = { duration: 760, delay: delay + index * 9, fill: "both" };
  return [
    item.actor.animate(
      [
        {
          transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(.55)`,
          opacity: 0,
        },
        { opacity: 0.75, offset: 0.22 },
        {
          transform: "translate(-50%, -50%) scale(1.2)",
          opacity: 0.7,
          offset: 0.82,
        },
        { transform: "translate(-50%, -50%) scale(1.25)", opacity: 0 },
      ],
      { ...options, easing: "cubic-bezier(.16,1,.3,1)" },
    ),
    item.rune.animate(
      [
        { opacity: 1 },
        { opacity: 1, offset: 0.48 },
        { opacity: 0, offset: 0.8 },
        { opacity: 0 },
      ],
      options,
    ),
    item.letter.animate(
      [
        { opacity: 0 },
        { opacity: 0, offset: 0.42 },
        { opacity: 1, offset: 0.8 },
        { opacity: 1 },
      ],
      options,
    ),
  ];
};

export const create_word_enchantment = (link) => {
  const label = link.querySelector("[data-inscription-text]");
  const text = label.textContent;
  const overlay = document.createElement("span");
  overlay.className = "sol__enchantment_letters";
  overlay.setAttribute("aria-hidden", "true");
  label.parentElement.append(overlay);
  const bleed = create_bleed_trail(overlay);
  const letters = create_letters(text, overlay, bleed);
  let animations = [];
  let generation = 0;
  let disposed = false;
  const restore = () => {
    generation++;
    for (const animation of animations) animation.cancel();
    animations = [];
    link.removeAttribute("data-enchantment-assembling");
  };
  return {
    reveal(delay = 0) {
      if (
        disposed ||
        animations.length ||
        typeof overlay.animate !== "function"
      )
        return;
      place_letters(label, text, letters, overlay, bleed);
      const run = ++generation;
      link.dataset.enchantmentAssembling = "true";
      animations = letters.flatMap((item, index) =>
        gather_letter(item, index, delay),
      );
      Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (run === generation) restore();
      });
    },
    measure() {
      if (!disposed) place_letters(label, text, letters, overlay, bleed);
    },
    restore,
    dispose() {
      disposed = true;
      restore();
      bleed.dispose();
      overlay.remove();
    },
  };
};
