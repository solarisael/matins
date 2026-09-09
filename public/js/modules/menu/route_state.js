import {
  is_section_path_active,
  normalize_pathname,
} from "../htmx_route_lifecycle.js";

let last_applied_route_pathname = null;

export const invalidate_side_menu_route_state = () => {
  last_applied_route_pathname = null;
};

const set_route_current = (route_node, is_exact_match, is_active) => {
  route_node.dataset.routeActive = is_active ? "true" : "false";
  if (is_exact_match) {
    route_node.setAttribute("aria-current", "page");
  } else if (is_active) {
    route_node.setAttribute("aria-current", "location");
  } else {
    route_node.removeAttribute("aria-current");
  }
};

const apply_route_link_state = (route_node, current_pathname) => {
  const target_pathname = normalize_pathname(
    new URL(route_node.href, window.location.origin).pathname,
  );
  const is_exact_match = current_pathname === target_pathname;
  const is_active =
    route_node.dataset.phase === "home"
      ? is_exact_match
      : is_section_path_active(current_pathname, target_pathname);
  set_route_current(route_node, is_exact_match, is_active);
};

const apply_route_links = (menu_node, current_pathname) => {
  for (const route_node of menu_node.querySelectorAll(
    "[data-side-menu-route]",
  )) {
    if (!(route_node instanceof HTMLAnchorElement)) {
      continue;
    }
    apply_route_link_state(route_node, current_pathname);
  }
};

/** @param {string | null} [pathname_override=null] */
export const apply_side_menu_route_state = (pathname_override = null) => {
  const menu_node = document.querySelector("#sol_side_menu");
  if (!(menu_node instanceof HTMLElement)) {
    return;
  }
  const current_pathname = normalize_pathname(
    pathname_override ?? window.location.pathname,
  );
  if (last_applied_route_pathname === current_pathname) {
    return;
  }
  apply_route_links(menu_node, current_pathname);
  last_applied_route_pathname = current_pathname;
};
