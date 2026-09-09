import { create_bleed_trail } from "./enchantment_bleed.js";

export const create_enchanted_rim = (host) => {
  const overlay = document.createElement("span");
  overlay.className = "sol__enchantment_letters sol__enchantment_rim";
  overlay.setAttribute("aria-hidden", "true");
  host.append(overlay);
  const trail = create_bleed_trail(overlay, { origin_radius: 0.5 });
  const motes = [...trail.add(), ...trail.add(), ...trail.add()];
  const measure = () => {
    trail.place(motes, {
      left: 0,
      top: 0,
      width: overlay.clientWidth,
      height: overlay.clientHeight,
    });
  };
  const resize = new ResizeObserver(measure);
  resize.observe(overlay);
  measure();
  return {
    dispose() {
      resize.disconnect();
      trail.dispose();
      overlay.remove();
    },
  };
};
