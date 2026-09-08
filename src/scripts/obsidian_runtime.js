const load_obsidian_gpu = async (canvas, options) => {
  const { create_obsidian_gpu } = await import("./obsidian_gpu.js");
  return create_obsidian_gpu(canvas, options);
};

export const create_obsidian_runtime = ({
  owner,
  menu,
  canvas,
  load_gpu = load_obsidian_gpu,
}) => {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const values = {
    resolution: [0, 0],
    tablet_size: [0, 0],
    tablet_origin: [0, 0],
    field_offset: [0, 0],
    halo: 0,
    rim: 0,
    time: 0,
  };
  let backend = null,
    pending = false,
    disposed = false,
    failed = false,
    activated = false,
    dirty = true,
    needs_frame = true,
    frame = null,
    last_frame = null,
    elapsed = 0;
  owner.dataset.obsidianRenderer = "static";
  let was_open = false;

  const active = () =>
    !disposed &&
    !failed &&
    owner.isConnected &&
    !document.hidden &&
    menu.dataset.sideMenuOpen === "true" &&
    menu.dataset.portalPhase === "artifact";

  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    last_frame = null;
  };
  const release = () => {
    const current = backend;
    backend = null;
    current?.dispose();
  };
  const fail = () => {
    if (disposed || failed) return;
    failed = true;
    cancel();
    owner.dataset.obsidianRenderer = "static";
    release();
  };
  const measure = () => {
    const surface = canvas.getBoundingClientRect();
    const tablet = owner.getBoundingClientRect();
    values.resolution[0] = surface.width;
    values.resolution[1] = surface.height;
    values.tablet_size[0] = tablet.width;
    values.tablet_size[1] = tablet.height;
    values.tablet_origin[0] = tablet.left - surface.left;
    values.tablet_origin[1] = tablet.top - surface.top;
    const style = getComputedStyle(owner);
    const halo = style.getPropertyValue("--obsidian-halo").trim();
    const unit = halo.endsWith("rem")
      ? parseFloat(getComputedStyle(document.documentElement).fontSize)
      : 1;
    values.halo = parseFloat(halo) * unit;
    values.rim =
      parseFloat(style.getPropertyValue("--obsidian-rim-width")) || 0;
    dirty = false;
  };
  const request = () => {
    if (!active() || !backend || frame !== null) return;
    if (motion.matches && !needs_frame) return;
    const scheduled = requestAnimationFrame((now) => {
      if (frame !== scheduled) return;
      frame = null;
      draw(now);
    });
    frame = scheduled;
  };
  const empty_size = () =>
    values.resolution[0] <= 0 ||
    values.resolution[1] <= 0 ||
    values.tablet_size[0] <= 0 ||
    values.tablet_size[1] <= 0;

  const update_time = (now) => {
    if (!motion.matches && last_frame !== null) elapsed += now - last_frame;
    last_frame = now;
    values.time = motion.matches ? 0 : elapsed / 1000;
  };

  const render = () => {
    try {
      backend.render(values);
    } catch {
      fail();
      return;
    }
    if (!active() || !backend) return;
    owner.dataset.obsidianRenderer = "webgpu";
    needs_frame = false;
    if (!motion.matches) request();
  };

  function draw(now) {
    if (!active() || !backend) {
      activated = false;
      cancel();
      return;
    }
    if (last_frame !== null && now - last_frame < 1000 / 30) {
      request();
      return;
    }
    if (dirty) measure();
    if (empty_size()) {
      last_frame = null;
      return;
    }
    update_time(now);
    render();
  }
  const initialize = async () => {
    if (pending || backend || !active()) return;
    pending = true;
    owner.dataset.obsidianRenderer = "loading";
    try {
      const loaded = await load_gpu(canvas, { on_error: fail });
      if (disposed || failed) {
        loaded.dispose();
        return;
      }
      backend = loaded;
      sync();
    } catch {
      fail();
    } finally {
      pending = false;
    }
  };
  function sync() {
    if (disposed || failed) return;
    const is_open = menu.dataset.sideMenuOpen === "true";
    if (is_open && !was_open) {
      values.field_offset[0] = Math.random();
      values.field_offset[1] = Math.random();
    }
    was_open = is_open;
    if (!active()) {
      activated = false;
      cancel();
      return;
    }
    if (!activated) {
      activated = true;
      dirty = true;
      needs_frame = true;
      measure();
    }
    if (backend) request();
    else void initialize();
  }
  const invalidate = () => {
    if (disposed || failed) return;
    dirty = true;
    needs_frame = true;
    sync();
  };
  const motion_change = () => {
    if (disposed || failed) return;
    cancel();
    invalidate();
  };
  const attributes = new MutationObserver(sync);
  attributes.observe(menu, {
    attributes: true,
    attributeFilter: ["data-side-menu-open", "data-portal-phase"],
  });
  const resize = new ResizeObserver(invalidate);
  resize.observe(owner);
  resize.observe(canvas);
  motion.addEventListener("change", motion_change);
  document.addEventListener("visibilitychange", sync);
  sync();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      attributes.disconnect();
      resize.disconnect();
      motion.removeEventListener("change", motion_change);
      document.removeEventListener("visibilitychange", sync);
      owner.dataset.obsidianRenderer = "static";
      release();
    },
  };
};
