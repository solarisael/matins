import {
  create_enchanted_glyph,
  refresh_enchanted_glyph,
} from "./enchantment_glyphs.js";

const position_particle = (particle) => {
  const { node, box, angle, origin_radius } = particle;
  node.style.left = `${box.left + box.width * (0.5 + Math.cos(angle) * origin_radius)}px`;
  node.style.top = `${box.top + box.height * (0.5 + Math.sin(angle) * origin_radius)}px`;
};

const renew_particle = (particle) => {
  particle.angle = Math.random() * Math.PI * 2;
  const distance = 1.0 + Math.random() * 0.8;
  const { node, angle } = particle;
  refresh_enchanted_glyph(node);
  node.style.setProperty("--bleed-x", `${Math.cos(angle) * distance}rem`);
  node.style.setProperty("--bleed-y", `${Math.sin(angle) * distance}rem`);
  node.style.setProperty("--bleed-turn", `${(Math.random() - 0.5) * 65}deg`);
  if (particle.box) position_particle(particle);
};

export const create_bleed_trail = (overlay, { origin_radius = 0.2 } = {}) => {
  const particles = new Map();
  const on_cycle = (event) => {
    if (event.animationName !== "enchanted-bleed") return;
    const particle = particles.get(event.target);
    if (particle) renew_particle(particle);
  };
  overlay.addEventListener("animationiteration", on_cycle);
  return {
    add() {
      const duration = 6.2 + Math.random() * 2.8;
      const phase = Math.random() * duration;
      return [0, 0.5].map((stagger) => {
        const node = create_enchanted_glyph();
        node.classList.add("sol__letter_bleed");
        node.style.animationDuration = `${duration}s`;
        node.style.animationDelay = `${-phase - duration * stagger}s`;
        const particle = { node, angle: 0, box: null, origin_radius };
        particles.set(node, particle);
        renew_particle(particle);
        overlay.append(node);
        return particle;
      });
    },
    place(group, box) {
      for (const particle of group) {
        particle.box = box;
        position_particle(particle);
      }
    },
    dispose() {
      overlay.removeEventListener("animationiteration", on_cycle);
      for (const particle of particles.values()) particle.node.remove();
      particles.clear();
    },
  };
};
