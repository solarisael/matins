export function create_obsidian_preview({ owner, menu }) {
  const toolbar = owner.querySelector("[data-obsidian-preview-toolbar]");
  if (!toolbar) return { dispose() {} };

  const viewport = owner.querySelector(".sol__obsidian_viewport");
  const toggle = toolbar.querySelector("[data-obsidian-preview-toggle]");
  const close = toolbar.querySelector("[data-obsidian-preview-close]");
  let previous_inert = viewport.inert;
  let preview = false;

  const set_preview = (enabled) => {
    if (enabled) {
      previous_inert = viewport.inert;
      if (viewport.contains(owner.ownerDocument.activeElement)) toggle.focus();
      viewport.inert = true;
    } else {
      viewport.inert = previous_inert;
    }
    preview = enabled;
    owner.dataset.obsidianPreview = String(enabled);
    toggle.setAttribute("aria-pressed", String(enabled));
  };
  const sync_menu = () => {
    toolbar.inert = menu.dataset.sideMenuOpen !== "true";
  };
  const on_toggle = () => set_preview(!preview);
  const on_close = () => menu.querySelector("[data-side-menu-close]")?.click();
  const observer = new MutationObserver(sync_menu);
  observer.observe(menu, {
    attributes: true,
    attributeFilter: ["data-side-menu-open"],
  });
  sync_menu();
  set_preview(true);
  toggle.addEventListener("click", on_toggle);
  close.addEventListener("click", on_close);

  return {
    dispose() {
      observer.disconnect();
      toggle.removeEventListener("click", on_toggle);
      close.removeEventListener("click", on_close);
      if (preview) set_preview(false);
      toolbar.inert = true;
    },
  };
}
