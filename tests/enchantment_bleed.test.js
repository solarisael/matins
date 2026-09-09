import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { create_bleed_trail } from "../src/scripts/enchantment_bleed.js";

if (!globalThis.window)
  GlobalRegistrator.register({ url: "https://solarisael.local/" });

let overlay, trail, random;
const cycle = (node, name = "enchanted-bleed") => {
  const event = new Event("animationiteration", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: name });
  node.dispatchEvent(event);
};

beforeEach(() => {
  overlay = document.createElement("span");
  document.body.append(overlay);
  random = spyOn(Math, "random").mockReturnValue(0.125);
  trail = create_bleed_trail(overlay);
});
afterEach(() => {
  trail.dispose();
  overlay.remove();
  random.mockRestore();
});

test("each letter receives overlapping trajectories anchored inside its glyph box", () => {
  const group = trail.add();
  expect(group.length).toBeGreaterThan(1);
  expect(
    new Set(group.map(({ node }) => node.style.animationDuration)).size,
  ).toBe(1);
  expect(new Set(group.map(({ node }) => node.style.animationDelay)).size).toBe(
    group.length,
  );
  const box = { left: 20, top: 30, width: 18, height: 40 };
  trail.place(group, box);
  for (const { node } of group) {
    expect(parseFloat(node.style.left)).toBeGreaterThanOrEqual(box.left);
    expect(parseFloat(node.style.left)).toBeLessThanOrEqual(
      box.left + box.width,
    );
    expect(parseFloat(node.style.top)).toBeGreaterThanOrEqual(box.top);
    expect(parseFloat(node.style.top)).toBeLessThanOrEqual(
      box.top + box.height,
    );
  }
});

test("a completed life chooses a fresh glyph and can reverse both travel directions", () => {
  const group = trail.add();
  trail.place(group, { left: 0, top: 0, width: 20, height: 40 });
  const node = group[0].node;
  const original = node.textContent;
  expect(parseFloat(node.style.getPropertyValue("--bleed-x"))).toBeGreaterThan(
    0,
  );
  expect(parseFloat(node.style.getPropertyValue("--bleed-y"))).toBeGreaterThan(
    0,
  );
  random.mockReturnValue(0.625);
  cycle(node, "another-animation");
  expect(node.textContent).toBe(original);
  cycle(node);
  expect(parseFloat(node.style.getPropertyValue("--bleed-x"))).toBeLessThan(0);
  expect(parseFloat(node.style.getPropertyValue("--bleed-y"))).toBeLessThan(0);
  expect(node.textContent).not.toBe(original);
});

test("continuous renewal reuses its bounded nodes instead of accumulating particles", () => {
  const group = trail.add();
  const count = overlay.childElementCount;
  for (let iteration = 0; iteration < 40; iteration++) {
    random.mockReturnValue((iteration + 0.5) / 41);
    for (const { node } of group) cycle(node);
  }
  expect(overlay.childElementCount).toBe(count);
  expect(group.every(({ node }) => node.parentElement === overlay)).toBe(true);
});

test("disposal removes particles and cannot renew a reattached stale node", () => {
  const group = trail.add();
  const node = group[0].node;
  const trajectory = node.style.getPropertyValue("--bleed-x");
  trail.dispose();
  expect(overlay.childElementCount).toBe(0);
  overlay.append(node);
  random.mockReturnValue(0.625);
  cycle(node);
  expect(node.style.getPropertyValue("--bleed-x")).toBe(trajectory);
});
