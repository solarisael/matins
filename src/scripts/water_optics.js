export const WATER_OPTICS = Object.freeze({
  absorption: 0.022,
  near_depth: 8,
  far_depth: 24,
  wave_depth: 8,
});

export const water_transmission = (depth) =>
  Math.exp(-WATER_OPTICS.absorption * Math.max(0, depth));

export const WATER_TRANSMISSION = Object.freeze({
  near: water_transmission(WATER_OPTICS.near_depth),
  far: water_transmission(WATER_OPTICS.far_depth),
});
