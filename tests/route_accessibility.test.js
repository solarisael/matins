import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { announce_and_focus_route } from "../public/js/modules/route_accessibility.js";

if (!globalThis.window)
  GlobalRegistrator.register({ url: "https://solarisael.local/" });

const fixture = () => {
  document.body.innerHTML =
    '<main id="sol_page_shell"><h1>Work</h1></main><p id="sol_route_status"></p><dialog id="sol_side_menu_panel"><button>close</button></dialog>';
  return {
    dialog: document.querySelector("dialog"),
    heading: document.querySelector("h1"),
  };
};
afterEach(() => {
  document.body.innerHTML = "";
});

describe("route focus across an animated modal close", () => {
  test("waits for the dialog to close and then focuses the latest heading", async () => {
    const { dialog, heading } = fixture();
    dialog.showModal();
    dialog.querySelector("button").focus();
    announce_and_focus_route();
    announce_and_focus_route();
    expect(document.activeElement).not.toBe(heading);
    expect(document.querySelector("#sol_route_status").textContent).toBe("");
    heading.textContent = "Writing";
    dialog.close();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector("#sol_route_status").textContent).toBe(
      "Loaded Writing.",
    );
  });

  test("focuses immediately when navigation is already closed", () => {
    const { heading } = fixture();
    announce_and_focus_route();
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector("#sol_route_status").textContent).toBe(
      "Loaded Work.",
    );
  });
});
