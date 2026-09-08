import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { create_portal_inscriptions } from "../src/scripts/portal_inscriptions.js";
import { clearCache } from "@chenglou/pretext";
import { define_inscription_element } from "../src/scripts/inscription_element.js";
const original_offscreen_canvas = globalThis.OffscreenCanvas;

if (!globalThis.window)
  GlobalRegistrator.register({ url: "https://solarisael.local/" });

let menu, controller, frames, now, next_id, motion, spies, hidden_descriptor;
const labels = () => [...menu.querySelectorAll("[data-inscription-text]")];
const hover = (index = 0) =>
  labels()[index].dispatchEvent(new Event("pointerover", { bubbles: true }));
const advance = (time) => {
  now = time;
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(time));
};

beforeEach(() => {
  hidden_descriptor = Object.getOwnPropertyDescriptor(document, "hidden");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  frames = new Map();
  now = 0;
  next_id = 0;
  motion = new EventTarget();
  motion.matches = false;
  globalThis.OffscreenCanvas = class {
    getContext() {
      return {
        font: "",
        measureText: (text) => ({ width: String(text).length * 10 }),
      };
    }
  };
  spies = [
    spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: (text) => ({ width: String(text).length * 10 }),
    }),
    spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) => {
        frames.set(++next_id, callback);
        return next_id;
      },
    ),
    spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) =>
      frames.delete(id),
    ),
    spyOn(globalThis, "matchMedia").mockReturnValue(motion),
    spyOn(performance, "now").mockImplementation(() => now),
    spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      array[0] = 12345;
      return array;
    }),
  ];
  clearCache();
  define_inscription_element();
  menu = document.createElement("div");
  menu.dataset.sideMenuOpen = "true";
  menu.innerHTML =
    '<a class="sol__side_menu_route"><span><sol-inscription manual><span class="sr-only">Writing Gate</span><span data-inscription-text aria-hidden="true">Writing Gate</span></sol-inscription></span><small>Read here</small></a><a class="sol__side_menu_route"><span><sol-inscription manual><span class="sr-only">Work</span><span data-inscription-text aria-hidden="true">Work</span></sol-inscription></span></a>';
  document.body.append(menu);
  controller = create_portal_inscriptions(menu);
});

afterEach(() => {
  controller.dispose();
  menu.remove();
  globalThis.OffscreenCanvas = original_offscreen_canvas;
  spies.forEach((spy) => spy.mockRestore());
  if (hidden_descriptor)
    Object.defineProperty(document, "hidden", hidden_descriptor);
  else delete document.hidden;
});

test("rapid hover and focus cannot restart the active sequence or delay readable text", () => {
  hover();
  advance(0);
  expect(labels()[0].textContent).not.toBe("Writing Gate");
  expect(labels()[0].textContent[7]).toBe(" ");
  expect(menu.querySelector("a").getAttribute("aria-label")).toBe(
    "Writing Gate. Read here",
  );
  for (let time = 30; time < 360; time += 30) {
    for (let i = 0; i < 50; i++) hover();
    labels()[0].dispatchEvent(new Event("focusin", { bubbles: true }));
    advance(time);
  }
  advance(360);
  expect(labels()[0].textContent).toBe("Writing Gate");
  expect(frames.size).toBe(0);
});

test("a new hover varies the sequence while unrelated labels retain independent seeds", () => {
  hover(1);
  advance(0);
  const first = labels()[1].textContent;
  advance(360);
  hover(0);
  advance(360);
  advance(720);
  hover(1);
  advance(720);
  const second = labels()[1].textContent;
  expect(second).not.toBe(first);
  controller.dispose();
  controller = create_portal_inscriptions(menu);
  hover(1);
  advance(720);
  expect(labels()[1].textContent).toBe(first);
  advance(1080);
  hover(1);
  advance(1080);
  expect(labels()[1].textContent).toBe(second);
});

test("consecutive symbol frames avoid repeating the same glyph in an unresolved position", () => {
  hover();
  advance(0);
  const first = labels()[0].textContent;
  advance(45);
  const second = labels()[0].textContent;
  for (let i = 1; i < second.length; i++) {
    if (i !== 7) expect(second[i]).not.toBe(first[i]);
  }
});

test("restore invalidates stale callbacks before a new hover takes ownership", () => {
  hover();
  const stale = [...frames.values()][0];
  controller.restore();
  hover();
  advance(0);
  const current = labels()[0].textContent;
  stale(360);
  expect(labels()[0].textContent).toBe(current);
  advance(360);
  expect(labels()[0].textContent).toBe("Writing Gate");
});

test("close, reduced motion, visibility loss, and disposal restore readable labels", () => {
  hover();
  advance(0);
  menu.dataset.sideMenuOpen = "false";
  advance(45);
  expect(labels()[0].textContent).toBe("Writing Gate");
  menu.dataset.sideMenuOpen = "true";
  hover();
  advance(45);
  motion.matches = true;
  motion.dispatchEvent(new Event("change"));
  expect(labels()[0].textContent).toBe("Writing Gate");
  hover();
  expect(frames.size).toBe(0);
  motion.matches = false;
  hover();
  advance(90);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(labels()[0].textContent).toBe("Writing Gate");
  expect(frames.size).toBe(0);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  hover();
  advance(135);
  controller.dispose();
  hover();
  expect(labels()[0].textContent).toBe("Writing Gate");
  expect(frames.size).toBe(0);
});

test("standalone wrappers animate from keyboard focus and reconnect without stale frames", () => {
  const button = document.createElement("button");
  button.innerHTML =
    '<sol-inscription><span class="sr-only">Little gate</span><span data-inscription-text aria-hidden="true">Little gate</span></sol-inscription>';
  menu.append(button);
  const visual = button.querySelector("[data-inscription-text]");
  button.dispatchEvent(new Event("focusin", { bubbles: true }));
  advance(0);
  expect(visual.textContent).not.toBe("Little gate");
  expect(button.querySelector(".sr-only").textContent).toBe("Little gate");
  const stale = [...frames.values()][0];
  button.remove();
  expect(visual.textContent).toBe("Little gate");
  expect(frames.size).toBe(0);
  menu.append(button);
  button.dispatchEvent(new Event("focusin", { bubbles: true }));
  advance(45);
  const current = visual.textContent;
  stale(400);
  expect(visual.textContent).toBe(current);
  advance(405);
  expect(visual.textContent).toBe("Little gate");
  expect(frames.size).toBe(0);
});

test("standalone wrappers keep their original text under reduced motion", () => {
  motion.matches = true;
  const button = document.createElement("button");
  button.innerHTML =
    '<sol-inscription><span class="sr-only">Quiet gate</span><span data-inscription-text aria-hidden="true">Quiet gate</span></sol-inscription>';
  menu.append(button);
  button.dispatchEvent(new Event("focusin", { bubbles: true }));
  advance(0);
  expect(button.querySelector("[data-inscription-text]").textContent).toBe(
    "Quiet gate",
  );
  expect(button.querySelector(".sr-only").textContent).toBe("Quiet gate");
  expect(frames.size).toBe(0);
});
