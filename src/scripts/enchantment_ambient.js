import { create_enchanted_glyph } from "./enchantment_glyphs.js";
import { WATER_TRANSMISSION } from "./water_optics.js";

export const create_ambient_glyphs = (layer) => {
  const glyphs = [];
  for (let index = 0; index < 36; index++) {
    const glyph = create_enchanted_glyph();
    const near = index % 3 === 0;
    const depth = near
      ? { size: "1.725rem", light: "0.66", softness: "0.15px" }
      : { size: "1.125rem", light: "0.285", softness: "0.65px" };
    const side = index % 2 === 0 ? -1 : 1;
    const x = 50 + side * (24 + Math.random() * 21);
    glyph.classList.add("sol__ambient_glyph");
    glyph.dataset.glyphDepth = near ? "near" : "far";
    glyph.style.setProperty(
      "--water-transmission",
      near ? WATER_TRANSMISSION.near : WATER_TRANSMISSION.far,
    );
    glyph.style.left = `${x}%`;
    glyph.style.top = `${5 + Math.random() * 90}%`;
    glyph.style.setProperty("--glyph-size", depth.size);
    glyph.style.setProperty("--glyph-light", depth.light);
    glyph.style.setProperty("--glyph-softness", depth.softness);
    glyph.style.setProperty("--glyph-x", `${(Math.random() - 0.5) * 3}rem`);
    glyph.style.setProperty("--glyph-y", `${(Math.random() - 0.5) * 5}rem`);
    glyph.style.setProperty("--glyph-turn", `${(Math.random() - 0.5) * 22}deg`);
    glyph.style.animationDuration = `${17 + Math.random() * 19}s`;
    glyph.style.animationDelay = `${-Math.random() * 32}s`;
    layer.append(glyph);
    glyphs.push(glyph);
  }
  return {
    dispose() {
      for (const glyph of glyphs) glyph.remove();
    },
  };
};
