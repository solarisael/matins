import { create_ambient_glyphs } from "./enchantment_ambient.js";
import { create_word_enchantment } from "./enchantment_word.js";
import { create_enchanted_rim } from "./enchantment_rim.js";
import { acquire_element_depth } from "./element_depth.js";
import {
  load_enchantment_fonts,
  RUNIC_GLYPHS,
  SYMBOL_GLYPHS,
} from "./enchantment_glyphs.js";
import { create_portal_inscriptions } from "./portal_inscriptions.js";

const route_from = (target) =>
  target instanceof Element ? target.closest("[data-side-menu-route]") : null;

export const create_portal_enchantment = (
  menu,
  { load_fonts = load_enchantment_fonts } = {},
) => {
  const layer = menu.querySelector("[data-portal-glyphs]");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const words = new Map();
  for (const link of menu.querySelectorAll("[data-side-menu-route]")) {
    if (link.querySelector("[data-inscription-text]")) {
      words.set(link, create_word_enchantment(link));
    }
  }
  const ambient = create_ambient_glyphs(layer);
  const close = menu.querySelector("[data-side-menu-close]");
  const rim = close ? create_enchanted_rim(close) : null;
  const depth = acquire_element_depth(menu);
  let disposed = false;
  let fonts_ready = false;
  let fonts_pending = false;
  let fonts_failed = false;
  let revealed = false;
  const visible = () =>
    menu.dataset.sideMenuOpen === "true" &&
    menu.dataset.portalPhase === "artifact" &&
    menu.dataset.sideMenuView === "root";
  const enabled = () =>
    !disposed &&
    !document.hidden &&
    !motion.matches &&
    menu.isConnected &&
    visible();
  const inscriptions = create_portal_inscriptions(menu, {
    glyphs: [...RUNIC_GLYPHS, ...SYMBOL_GLYPHS],
    is_enabled: () => fonts_ready && enabled(),
  });
  const restore = () => {
    revealed = false;
    menu.dataset.portalEnchantment = "quiet";
    inscriptions.restore();
    for (const word of words.values()) word.restore();
  };
  const reveal = () => {
    if (!enabled() || !fonts_ready || revealed) return;
    revealed = true;
    menu.dataset.portalEnchantment = "active";
    inscriptions.reveal();
    let index = 0;
    for (const word of words.values()) word.reveal(index++ * 35);
  };
  const start_fonts = () => {
    if (fonts_pending || fonts_ready || fonts_failed) return;
    fonts_pending = true;
    load_fonts()
      .then(() => {
        if (disposed) return;
        fonts_ready = true;
        sync();
      })
      .catch((error) => {
        if (disposed) return;
        fonts_failed = true;
        restore();
        console.warn(
          "Enchanted glyphs unavailable; the menu keeps readable text.",
          error,
        );
      })
      .finally(() => {
        fonts_pending = false;
      });
  };
  function sync() {
    if (disposed) return;
    if (!enabled()) {
      restore();
      return;
    }
    if (!fonts_ready) {
      start_fonts();
      return;
    }
    reveal();
  }
  const enchant = (route) => {
    if (!enabled() || !fonts_ready) return;
    words.get(route)?.reveal();
  };
  const on_selection = (event) => {
    const route = route_from(event.target);
    if (!route) return;
    if (event.type === "pointerover" && route.contains(event.relatedTarget))
      return;
    enchant(route);
  };
  const on_touch = (event) => enchant(event.detail.route);
  const measure = () => {
    if (!enabled() || !fonts_ready) return;
    for (const word of words.values()) word.measure();
  };
  const attributes = new MutationObserver(sync);
  attributes.observe(menu, {
    attributes: true,
    subtree: true,
    attributeFilter: [
      "data-side-menu-open",
      "data-portal-phase",
      "data-side-menu-view",
    ],
  });
  const resize = new ResizeObserver(measure);
  resize.observe(layer.parentElement);
  menu.addEventListener("sol:portal-revealed", sync);
  menu.addEventListener("sol:portal-enchant", on_touch);
  menu.addEventListener("pointerover", on_selection);
  menu.addEventListener("focusin", on_selection);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", sync);
  menu.dataset.portalEnchantment = "quiet";
  sync();
  return {
    sync,
    restore,
    dispose() {
      if (disposed) return;
      disposed = true;
      attributes.disconnect();
      resize.disconnect();
      menu.removeEventListener("sol:portal-revealed", sync);
      menu.removeEventListener("sol:portal-enchant", on_touch);
      menu.removeEventListener("pointerover", on_selection);
      menu.removeEventListener("focusin", on_selection);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      inscriptions.dispose();
      for (const word of words.values()) word.dispose();
      ambient.dispose();
      rim?.dispose();
      depth.release();
      delete menu.dataset.portalEnchantment;
    },
  };
};
