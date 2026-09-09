export const create_obsidian_button_geometry = (owner) => {
  const buttons = owner.querySelectorAll("[data-obsidian-button]");
  const scrollport =
    owner.querySelector("#sol_side_menu_panel_scroll") ?? owner;
  const clip = [0, 0, 0, 0];

  const measure_clip = (tablet, rim) => {
    const rect = scrollport.getBoundingClientRect();
    clip[0] = Math.max(rim, rect.left - tablet.left);
    clip[1] = Math.max(rim, rect.top - tablet.top);
    clip[2] = Math.min(tablet.width - rim, rect.right - tablet.left);
    clip[3] = Math.min(tablet.height - rim, rect.bottom - tablet.top);
  };

  const measure = (tablet, values) => {
    measure_clip(tablet, values.rim);
    const bounds = values.button_bounds;
    bounds[0] = tablet.width;
    bounds[1] = tablet.height;
    bounds[2] = bounds[3] = 0;
    values.button_count = 0;
    for (const button of buttons) {
      if (
        button.closest('[inert], [aria-hidden="true"]') ||
        !button.checkVisibility()
      )
        continue;
      const rect = button.getBoundingClientRect();
      const rx = rect.width / 2 - 2;
      const ry = rect.height / 2 - 2;
      if (rx <= 0 || ry <= 0) continue;
      const cx = rect.left + rect.width / 2 - tablet.left;
      const cy = rect.top + rect.height / 2 - tablet.top;
      const x0 = Math.max(clip[0], cx - rx);
      const y0 = Math.max(clip[1], cy - ry);
      const x1 = Math.min(clip[2], cx + rx);
      const y1 = Math.min(clip[3], cy + ry);
      if (x1 <= x0 || y1 <= y0) continue;
      if (values.button_count === values.button_regions.length) break;
      const region = values.button_regions[values.button_count++];
      region[0] = cx;
      region[1] = cy;
      region[2] = rx;
      region[3] = ry;
      bounds[0] = Math.min(bounds[0], x0);
      bounds[1] = Math.min(bounds[1], y0);
      bounds[2] = Math.max(bounds[2], x1);
      bounds[3] = Math.max(bounds[3], y1);
    }
  };

  return {
    measure,
    observe(resize) {
      resize.observe(scrollport);
      for (const button of buttons) resize.observe(button);
    },
  };
};
