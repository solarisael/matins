const route_selector = "a[href][data-side-menu-route]";
const unavailable_selector =
  "[inert], [hidden], [aria-hidden='true'], [disabled], [aria-disabled='true']";

const route_at = (menu, target) => {
  const route = target?.closest?.(route_selector);
  return route && menu.contains(route) ? route : null;
};

const is_plain_primary_click = (event) =>
  event.detail !== 0 &&
  event.button === 0 &&
  !event.defaultPrevented &&
  !(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey);

const is_artifact_open = (menu) =>
  menu.dataset.sideMenuOpen === "true" &&
  menu.dataset.portalPhase === "artifact";

const is_available_route = (route) =>
  Boolean(route) && !route.closest(unavailable_selector);

const is_touch_click = (event, route, touch_route) => {
  if (event.pointerType) return event.pointerType === "touch";
  return route !== null && route === touch_route;
};

const original_label = (route) =>
  route.dataset.navLabel ||
  (route.querySelector("[data-inscription-text]") ?? route).textContent.trim();

export const bind_portal_touch = (menu) => {
  const document = menu.ownerDocument;
  const view = document.defaultView;
  const hint = menu.querySelector("[data-portal-touch-hint]");
  const labels = new WeakMap();
  for (const route of menu.querySelectorAll(route_selector)) {
    labels.set(route, original_label(route));
  }
  let selected = null;
  let touch_route = null;

  const clear = () => {
    selected?.removeAttribute("data-portal-selected");
    selected = null;
    touch_route = null;
    if (hint) hint.hidden = true;
  };

  const on_pointerdown = (event) => {
    if (!selected?.contains(event.target)) clear();
    touch_route =
      event.pointerType === "touch" && event.isPrimary !== false
        ? route_at(menu, event.target)
        : null;
  };

  const on_pointercancel = () => {
    touch_route = null;
  };

  const select = (route) => {
    clear();
    selected = route;
    route.dataset.portalSelected = "true";
    if (hint) {
      hint.textContent = `tap again to enter ${labels.get(route) ?? original_label(route)}`;
      hint.hidden = false;
    }
    menu.dispatchEvent(
      new view.CustomEvent("sol:portal-enchant", { detail: { route } }),
    );
  };

  const on_click = (event) => {
    const route = route_at(menu, event.target);
    const touch = is_touch_click(event, route, touch_route);
    touch_route = null;
    if (!is_plain_primary_click(event) || !touch) return;
    if (!is_artifact_open(menu) || document.hidden) return;
    if (!is_available_route(route)) return;
    if (route === selected) {
      clear();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    select(route);
  };

  const on_visibility = () => {
    if (document.hidden) clear();
  };
  const on_state_change = (records) => {
    const changed = records.some(
      (record) => record.oldValue !== menu.getAttribute(record.attributeName),
    );
    if (changed) clear();
  };
  const observer = new view.MutationObserver(on_state_change);
  observer.observe(menu, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["data-side-menu-open", "data-side-menu-view"],
  });
  document.addEventListener("pointerdown", on_pointerdown, true);
  document.addEventListener("pointercancel", on_pointercancel, true);
  document.addEventListener("visibilitychange", on_visibility);
  menu.addEventListener("click", on_click, true);

  return {
    clear,
    dispose() {
      observer.disconnect();
      document.removeEventListener("pointerdown", on_pointerdown, true);
      document.removeEventListener("pointercancel", on_pointercancel, true);
      document.removeEventListener("visibilitychange", on_visibility);
      menu.removeEventListener("click", on_click, true);
      clear();
    },
  };
};
