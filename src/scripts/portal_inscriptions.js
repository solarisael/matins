import { create_inscription } from "./inscription.js";
import { size_inscription } from "./inscription_element.js";

export const create_portal_inscriptions = (
  menu,
  { glyphs, is_enabled = () => true } = {},
) => {
  const inscriptions = [];
  for (const label of menu.querySelectorAll(
    ".sol__side_menu_route [data-inscription-text]",
  )) {
    const link = label.closest("a");
    link.setAttribute("aria-label", label.textContent);
    inscriptions.push(
      create_inscription(label, {
        trigger: link,
        is_enabled: () => menu.dataset.sideMenuOpen === "true" && is_enabled(),
        prepare_label: size_inscription,
        glyphs,
      }),
    );
  }
  const reveal = () =>
    inscriptions.forEach((inscription) => inscription.reveal());
  const restore = () =>
    inscriptions.forEach((inscription) => inscription.restore());
  menu.addEventListener("sol:portal-revealed", reveal);
  return {
    reveal,
    restore,
    dispose() {
      inscriptions.forEach((inscription) => inscription.dispose());
      menu.removeEventListener("sol:portal-revealed", reveal);
    },
  };
};
