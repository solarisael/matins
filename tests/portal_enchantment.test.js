import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { create_portal_enchantment } from "../src/scripts/portal_enchantment.js";
import { create_word_enchantment } from "../src/scripts/enchantment_word.js";

if (!globalThis.window)
  GlobalRegistrator.register({ url: "https://solarisael.local/" });

let menu,
  controller,
  motion,
  fonts,
  load_fonts,
  spies,
  animations,
  hidden_descriptor;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  hidden_descriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  motion = new EventTarget();
  motion.matches = false;
  animations = [];
  spies = [
    spyOn(globalThis, "matchMedia").mockReturnValue(motion),
    spyOn(console, "warn").mockImplementation(() => {}),
  ];
  menu = document.createElement("div");
  menu.dataset.sideMenuOpen = "false";
  menu.dataset.portalPhase = "closed";
  menu.dataset.sideMenuView = "root";
  menu.innerHTML = `<sol-obsidian-tablet><div>
    <div data-portal-glyphs aria-hidden="true"></div>
    <a href="/writing" data-side-menu-route><sol-inscription manual>
      <span class="sr-only">writing</span><span data-inscription-text aria-hidden="true">writing</span>
    </sol-inscription></a>
  </div></sol-obsidian-tablet>`;
  document.body.append(menu);
  fonts = Promise.withResolvers();
  load_fonts = mock(() => fonts.promise);
});

afterEach(async () => {
  controller?.dispose();
  controller = null;
  menu.remove();
  await settle();
  spies.forEach((spy) => spy.mockRestore());
  if (animation_installed) {
    if (animation_descriptor)
      Object.defineProperty(Element.prototype, "animate", animation_descriptor);
    else delete Element.prototype.animate;
    animation_installed = false;
  }
  if (hidden_descriptor)
    Object.defineProperty(document, "hidden", hidden_descriptor);
  else delete document.hidden;
});

const open = async () => {
  menu.dataset.sideMenuOpen = "true";
  menu.dataset.portalPhase = "artifact";
  await settle();
};

let animation_descriptor;
let animation_installed = false;

const record_animations = () => {
  animation_descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate",
  );
  animation_installed = true;
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    writable: true,
    value: mock(() => {
      const finished = Promise.withResolvers();
      const animation = {
        finished: finished.promise,
        cancel: mock(() => finished.resolve()),
      };
      animations.push(animation);
      return animation;
    }),
  });
};

test("fonts wait for an open artifact and late readiness cannot revive a closed menu", async () => {
  controller = create_portal_enchantment(menu, { load_fonts });
  expect(load_fonts).not.toHaveBeenCalled();
  await open();
  expect(load_fonts).toHaveBeenCalledTimes(1);
  menu.dataset.sideMenuOpen = "false";
  fonts.resolve();
  await settle();
  expect(menu.dataset.portalEnchantment).toBe("quiet");
  expect(menu.querySelector("[data-inscription-text]").textContent).toBe(
    "writing",
  );
  await open();
  expect(menu.dataset.portalEnchantment).toBe("active");
  expect(load_fonts).toHaveBeenCalledTimes(1);
});

test("depth glyphs and letter bleed remain decorative and dispose without accumulation", async () => {
  controller = create_portal_enchantment(menu, { load_fonts });
  expect(
    menu.querySelectorAll("[data-glyph-depth=near]").length,
  ).toBeGreaterThan(0);
  expect(
    menu.querySelectorAll("[data-glyph-depth=far]").length,
  ).toBeGreaterThan(0);
  expect(menu.querySelectorAll(".sol__letter_bleed").length).toBeGreaterThan(0);
  expect(
    menu.querySelector(".sol__enchantment_letters").getAttribute("aria-hidden"),
  ).toBe("true");
  expect(menu.querySelector(".sr-only").textContent).toBe("writing");
  controller.dispose();
  expect(menu.querySelectorAll(".sol__enchanted_glyph").length).toBe(0);
  expect(menu.querySelector(".sol__enchantment_letters")).toBeNull();
  expect(menu.hasAttribute("data-portal-enchantment")).toBe(false);
  fonts.resolve();
  await settle();
  expect(menu.hasAttribute("data-portal-enchantment")).toBe(false);
});

test("reduced motion avoids fonts and gathers, then permits a normal-motion reveal", async () => {
  motion.matches = true;
  controller = create_portal_enchantment(menu, { load_fonts });
  await open();
  expect(menu.dataset.portalEnchantment).toBe("quiet");
  expect(load_fonts).not.toHaveBeenCalled();
  motion.matches = false;
  motion.dispatchEvent(new Event("change"));
  fonts.resolve();
  await settle();
  expect(menu.dataset.portalEnchantment).toBe("active");
  motion.matches = true;
  motion.dispatchEvent(new Event("change"));
  expect(menu.dataset.portalEnchantment).toBe("quiet");
  expect(menu.querySelector("[data-inscription-text]").textContent).toBe(
    "writing",
  );
});

test("settings and hidden document quiet the glyph field", async () => {
  controller = create_portal_enchantment(menu, { load_fonts });
  await open();
  fonts.resolve();
  await settle();
  menu.dataset.sideMenuView = "settings";
  await settle();
  expect(menu.dataset.portalEnchantment).toBe("quiet");
  menu.dataset.sideMenuView = "root";
  await settle();
  expect(menu.dataset.portalEnchantment).toBe("active");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(menu.dataset.portalEnchantment).toBe("quiet");
});

test("font failure leaves readable links and does not retry on every state change", async () => {
  controller = create_portal_enchantment(menu, { load_fonts });
  await open();
  fonts.reject(new Error("font unavailable"));
  await settle();
  expect(menu.dataset.portalEnchantment).toBe("quiet");
  menu.dataset.sideMenuView = "settings";
  await settle();
  menu.dataset.sideMenuView = "root";
  await settle();
  expect(load_fonts).toHaveBeenCalledTimes(1);
  expect(menu.querySelector("a").getAttribute("href")).toBe("/writing");
  expect(menu.querySelector("[data-inscription-text]").textContent).toBe(
    "writing",
  );
});

test("gathering owns its animation handles and stale completion cannot end a new gathering", async () => {
  record_animations();
  const link = menu.querySelector("a");
  controller = create_word_enchantment(link);
  controller.reveal();
  expect(animations.length).toBeGreaterThan(0);
  const first = [...animations];
  controller.reveal();
  expect(animations).toHaveLength(first.length);
  controller.restore();
  expect(
    first.every((animation) => animation.cancel.mock.calls.length === 1),
  ).toBe(true);
  controller.reveal();
  await settle();
  expect(link.dataset.enchantmentAssembling).toBe("true");
  controller.dispose();
  expect(link.hasAttribute("data-enchantment-assembling")).toBe(false);
  expect(link.querySelector(".sol__enchantment_letters")).toBeNull();
  expect(link.querySelector("[data-inscription-text]").textContent).toBe(
    "writing",
  );
});
