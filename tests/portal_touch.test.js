import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { bind_portal_touch } from "../src/scripts/portal_touch.js";
import { bind_navigation_controls } from "../public/js/modules/menu/navigation_controls.js";
import { set_menu_state } from "../public/js/modules/menu/view_state.js";
import {
  SITE_MENU_OPEN_COOKIE_NAME,
  SITE_MENU_VIEW_COOKIE_NAME,
  read_cookie_value,
  write_cookie_value,
} from "../public/js/modules/menu/preferences.js";

if (!globalThis.window) {
  GlobalRegistrator.register({ url: "https://solarisael.local/current/" });
}

const next_task = () => new Promise((resolve) => window.setTimeout(resolve, 0));
const pointer = (target, type = "pointerdown", pointerType = "touch") => {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, pointerType, isPrimary: true }),
  );
};
const click = (target, options = {}) => {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    detail: 1,
    button: 0,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
};
const tap = (target, options) => {
  pointer(target);
  return click(target, options);
};

describe("portal touch confirmation", () => {
  let menu;
  let first;
  let second;
  let hint;
  let controller;
  let navigated;
  let enchanted;
  let overflow;
  let cookies;
  let hidden_descriptor;
  const downstream = (event) => {
    if (event.target.closest?.("[data-side-menu-route]")) {
      navigated.push(event.defaultPrevented);
      event.preventDefault();
    }
  };

  beforeEach(async () => {
    overflow = document.documentElement.style.overflow;
    cookies = [SITE_MENU_OPEN_COOKIE_NAME, SITE_MENU_VIEW_COOKIE_NAME].map(
      (name) => [name, read_cookie_value(name)],
    );
    hidden_descriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    menu = document.createElement("div");
    menu.innerHTML = `
      <button data-side-menu-trigger>Menu</button>
      <dialog data-side-menu-panel-shell>
        <button data-side-menu-close>Close</button>
        <section data-side-menu-view-page="root">
          <a href="#first" data-side-menu-route data-nav-label="First" aria-label="First destination"><span>First glyph</span></a>
          <a href="#second" data-side-menu-route><span>Second</span></a>
        </section>
        <section data-side-menu-view-page="settings"></section>
        <p id="sol_portal_touch_hint" data-portal-touch-hint role="status" aria-live="polite" hidden></p>
      </dialog>`;
    document.body.append(menu);
    first = menu.querySelector("a");
    second = menu.querySelectorAll("a")[1];
    hint = menu.querySelector("[data-portal-touch-hint]");
    navigated = [];
    enchanted = [];
    menu.addEventListener("sol:portal-enchant", (event) =>
      enchanted.push(event.detail.route),
    );
    bind_navigation_controls(menu);
    set_menu_state(menu, true, "root");
    menu.dataset.portalPhase = "artifact";
    await next_task();
    controller = bind_portal_touch(menu);
    document.addEventListener("click", downstream);
  });

  afterEach(async () => {
    controller.dispose();
    document.removeEventListener("click", downstream);
    set_menu_state(menu, false, "root");
    menu.remove();
    await next_task();
    document.documentElement.style.overflow = overflow;
    if (hidden_descriptor)
      Object.defineProperty(document, "hidden", hidden_descriptor);
    else delete document.hidden;
    for (const [name, value] of cookies) {
      if (value === null) document.cookie = `${name}=; Max-Age=0; path=/`;
      else write_cookie_value(name, value);
    }
  });

  test("capture blocks first tap before route close and downstream navigation; second proceeds", () => {
    const first_tap = tap(first.firstElementChild);
    expect(first_tap.defaultPrevented).toBe(true);
    expect(navigated).toEqual([]);
    expect(menu.dataset.sideMenuOpen).toBe("true");
    expect(first.dataset.portalSelected).toBe("true");
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe("tap again to enter First");
    expect(enchanted).toEqual([first]);
    expect(first.getAttribute("aria-label")).toBe("First destination");
    expect(first.textContent).toBe("First glyph");
    expect(first.getAttribute("href")).toBe("#first");
    tap(first.firstElementChild);
    expect(navigated).toEqual([false]);
    expect(menu.dataset.sideMenuOpen).toBe("false");
    expect(first.hasAttribute("data-portal-selected")).toBe(false);
    expect(hint.hidden).toBe(true);
  });

  test("different destination reselects and retains its original label", () => {
    tap(first);
    second.firstElementChild.textContent = "shuffled glyphs";
    tap(second);
    expect(navigated).toEqual([]);
    expect(first.hasAttribute("data-portal-selected")).toBe(false);
    expect(second.dataset.portalSelected).toBe("true");
    expect(hint.textContent).toBe("tap again to enter Second");
    expect(enchanted).toEqual([first, second]);
  });

  test("PointerEvent click identifies touch without compatibility tracking", () => {
    const event = new PointerEvent("click", {
      bubbles: true,
      cancelable: true,
      detail: 1,
      button: 0,
      pointerType: "touch",
    });
    first.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(navigated).toEqual([]);
    expect(first.dataset.portalSelected).toBe("true");
  });

  test.each([
    ["keyboard or AT", { detail: 0 }],
    ["control", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["alt", { altKey: true }],
    ["shift", { shiftKey: true }],
    ["nonprimary", { button: 1 }],
  ])("%s activation bypasses confirmation", (_name, options) => {
    tap(first, options);
    expect(navigated).toEqual([false]);
    expect(enchanted).toEqual([]);
    expect(first.hasAttribute("data-portal-selected")).toBe(false);
  });

  test("genuine mouse pointerdown erases stale touch classification", () => {
    pointer(first);
    pointer(first, "pointerdown", "mouse");
    click(first);
    expect(navigated).toEqual([false]);
    expect(enchanted).toEqual([]);
  });

  test("explicit mouse click wins over stale compatibility tracking", () => {
    pointer(first);
    first.dispatchEvent(
      new PointerEvent("click", {
        bubbles: true,
        cancelable: true,
        detail: 1,
        pointerType: "mouse",
        button: 0,
      }),
    );
    expect(navigated).toEqual([false]);
    expect(enchanted).toEqual([]);
  });

  test("pointercancel cannot arm a later synthetic mouse click", () => {
    pointer(first);
    pointer(first, "pointercancel");
    click(first);
    expect(navigated).toEqual([false]);
    expect(enchanted).toEqual([]);
  });

  test("compatibility classification belongs to the touched destination", () => {
    pointer(first);
    click(second);
    expect(navigated).toEqual([false]);
    expect(enchanted).toEqual([]);
  });

  test.each(["inert", "hidden", "aria-hidden", "aria-disabled", "disabled"])(
    "routes under %s are not enchanted",
    (attribute) => {
      first.parentElement.setAttribute(attribute, "true");
      tap(first);
      expect(enchanted).toEqual([]);
      expect(first.hasAttribute("data-portal-selected")).toBe(false);
    },
  );

  test.each(["ink", "closing", "closed"])(
    "%s phase is not intercepted",
    (phase) => {
      menu.dataset.portalPhase = phase;
      tap(first);
      expect(navigated).toEqual([false]);
      expect(enchanted).toEqual([]);
    },
  );

  test("closed menu does not intercept even with artifact phase", () => {
    set_menu_state(menu, false, "root");
    tap(first);
    expect(navigated).toEqual([false]);
    expect(enchanted).toEqual([]);
  });

  test("outside pointerdown clears but pointerdown within the selected route does not", () => {
    tap(first);
    pointer(first.firstElementChild);
    expect(first.dataset.portalSelected).toBe("true");
    pointer(document.body);
    expect(first.hasAttribute("data-portal-selected")).toBe(false);
    expect(hint.hidden).toBe(true);
    tap(first);
    expect(navigated).toEqual([]);
  });

  test.each([
    ["sideMenuOpen", "false"],
    ["sideMenuView", "settings"],
  ])("%s state change clears selection", async (key, value) => {
    tap(first);
    menu.dataset[key] = value;
    await next_task();
    expect(first.hasAttribute("data-portal-selected")).toBe(false);
    expect(hint.hidden).toBe(true);
  });

  test("hidden document clears selection and does not intercept", () => {
    tap(first);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(first.hasAttribute("data-portal-selected")).toBe(false);
    expect(hint.hidden).toBe(true);
    tap(first);
    expect(navigated).toEqual([false]);
  });

  test("clear resets confirmation; disposal removes capture and state ownership", async () => {
    tap(first);
    controller.clear();
    expect(hint.hidden).toBe(true);
    tap(first);
    expect(navigated).toEqual([]);
    controller.dispose();
    expect(first.hasAttribute("data-portal-selected")).toBe(false);
    expect(hint.hidden).toBe(true);
    tap(first);
    expect(navigated).toEqual([false]);
    hint.hidden = false;
    pointer(document.body);
    document.dispatchEvent(new Event("visibilitychange"));
    menu.dataset.sideMenuView = "settings";
    await next_task();
    expect(hint.hidden).toBe(false);
  });
});
