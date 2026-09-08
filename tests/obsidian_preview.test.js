import { afterEach, beforeEach, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { create_obsidian_preview } from "../src/scripts/obsidian_preview.js";

if (!globalThis.window)
  GlobalRegistrator.register({ url: "https://solarisael.local/" });

let menu, owner, viewport, toggle, close, controller;

beforeEach(() => {
  menu = document.createElement("div");
  menu.dataset.sideMenuOpen = "true";
  menu.innerHTML = `
    <div role="dialog" aria-labelledby="preview_menu_title">
      <sol-obsidian-tablet>
        <div data-obsidian-preview-toolbar>
          <button data-obsidian-preview-toggle aria-pressed="false">Empty basin</button>
          <button data-obsidian-preview-close>Close</button>
        </div>
        <div class="sol__obsidian_viewport">
          <canvas data-portal-canvas></canvas>
          <div id="sol_side_menu_panel_scroll">
            <h2 id="preview_menu_title">Menu</h2>
            <button data-side-menu-close>Close menu</button>
            <a href="/writing">Writing</a>
          </div>
        </div>
      </sol-obsidian-tablet>
    </div>`;
  document.body.append(menu);
  owner = menu.querySelector("sol-obsidian-tablet");
  viewport = owner.querySelector(".sol__obsidian_viewport");
  toggle = owner.querySelector("[data-obsidian-preview-toggle]");
  close = owner.querySelector("[data-obsidian-preview-close]");
});

afterEach(() => {
  controller?.dispose();
  controller = null;
  menu.remove();
});

test("the dev toolbar starts preview with inert content and a resolvable dialog label", () => {
  controller = create_obsidian_preview({ owner, menu });
  expect(owner.dataset.obsidianPreview).toBe("true");
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(viewport.inert).toBe(true);
  expect(toggle.closest("[inert]")).toBeNull();
  const dialog = menu.querySelector("[role=dialog]");
  expect(
    document.getElementById(dialog.getAttribute("aria-labelledby")).textContent,
  ).toBe("Menu");
});

test("toggle restores the current inert state on each reversible preview", () => {
  viewport.inert = false;
  controller = create_obsidian_preview({ owner, menu });
  toggle.click();
  expect(owner.dataset.obsidianPreview).toBe("false");
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(viewport.inert).toBe(false);
  viewport.inert = true;
  toggle.click();
  expect(owner.dataset.obsidianPreview).toBe("true");
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  toggle.click();
  expect(viewport.inert).toBe(true);
});

test("entering preview hands viewport focus to its reachable toggle", () => {
  controller = create_obsidian_preview({ owner, menu });
  toggle.click();
  viewport.querySelector("a").focus();
  expect(document.activeElement).toBe(viewport.querySelector("a"));
  toggle.click();
  expect(document.activeElement).toBe(toggle);
  expect(viewport.inert).toBe(true);
});

test("close forwards to the existing control and closed menus exclude toolbar focus", async () => {
  menu.querySelector("[data-side-menu-close]").addEventListener("click", () => {
    menu.dataset.sideMenuOpen = "false";
  });
  controller = create_obsidian_preview({ owner, menu });
  close.click();
  expect(menu.dataset.sideMenuOpen).toBe("false");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(toggle.parentElement.inert).toBe(true);
  menu.dataset.sideMenuOpen = "true";
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(toggle.parentElement.inert).toBe(false);
});

test("a controller connected to a closed menu leaves its toolbar inert", () => {
  menu.dataset.sideMenuOpen = "false";
  controller = create_obsidian_preview({ owner, menu });
  expect(toggle.parentElement.inert).toBe(true);
  expect(viewport.inert).toBe(true);
});

test("disposal restores inert and detaches toggle, close, and menu observation", async () => {
  viewport.inert = false;
  let close_count = 0;
  menu
    .querySelector("[data-side-menu-close]")
    .addEventListener("click", () => close_count++);
  controller = create_obsidian_preview({ owner, menu });
  controller.dispose();
  expect(viewport.inert).toBe(false);
  expect(owner.dataset.obsidianPreview).toBe("false");
  toggle.click();
  close.click();
  expect(viewport.inert).toBe(false);
  expect(owner.dataset.obsidianPreview).toBe("false");
  expect(close_count).toBe(0);
  menu.dataset.sideMenuOpen = "false";
  menu.dataset.sideMenuOpen = "true";
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(toggle.parentElement.inert).toBe(true);
});

test("without a dev toolbar production state remains untouched", () => {
  toggle.parentElement.remove();
  viewport.inert = true;
  const markup = owner.outerHTML;
  controller = create_obsidian_preview({ owner, menu });
  controller.dispose();
  expect(owner.outerHTML).toBe(markup);
  expect(viewport.inert).toBe(true);
  expect(owner.hasAttribute("data-obsidian-preview")).toBe(false);
});
