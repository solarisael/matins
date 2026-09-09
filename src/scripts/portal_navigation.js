import { register_node_disposal } from "./node_disposal_bridge.js";
import { create_ink_shadow } from "./portal_ink.js";
import { create_portal_enchantment } from "./portal_enchantment.js";
import { bind_portal_touch } from "./portal_touch.js";

const mounted = new WeakSet();

const mount_portal = () => {
  const menu = document.querySelector("#sol_side_menu");
  if (!menu || mounted.has(menu)) return;
  const panel = menu.querySelector("dialog");
  const artifact = menu.querySelector("#sol_side_menu_panel_scroll");
  const canvas = menu.querySelector("[data-portal-ink]");
  if (!panel || !artifact || !canvas) return;
  mounted.add(menu);
  const ink = create_ink_shadow(menu, panel, canvas, artifact);
  const enchantment = create_portal_enchantment(menu);
  const touch = bind_portal_touch(menu);
  const synchronize = () => {
    if (menu.dataset.sideMenuOpen !== "true") {
      enchantment.restore();
      touch.clear();
      ink.close();
      return;
    }
    ink.open();
    enchantment.sync();
  };
  const observer = new MutationObserver(synchronize);
  observer.observe(menu, {
    attributes: true,
    attributeFilter: ["data-side-menu-open", "data-side-menu-view"],
  });
  register_node_disposal(menu, () => {
    observer.disconnect();
    touch.dispose();
    enchantment.dispose();
    ink.dispose();
    mounted.delete(menu);
  });
  synchronize();
};

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", mount_portal, { once: true });
else mount_portal();
document.addEventListener("htmx:afterSwap", mount_portal);
