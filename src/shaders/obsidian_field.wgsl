fn cell_point(cell: vec2f) -> vec2f {
  let wrapped = cell - floor(cell / 24.0) * 24.0;
  return 0.06 + 0.88 * fract(sin(vec2f(
    dot(wrapped, vec2f(127.1, 311.7)),
    dot(wrapped, vec2f(269.5, 183.3))
  )) * 43758.5453);
}

fn fracture_hash(cell: vec2f, period: f32) -> f32 {
  let wrapped = cell - floor(cell / period) * period;
  return fract(sin(dot(wrapped, vec2f(93.71, 271.49))) * 43758.5453);
}

fn fracture_noise(uv: vec2f, frequency: f32) -> f32 {
  let point = uv * frequency;
  let cell = floor(point);
  let fraction = fract(point);
  let blend = fraction * fraction * (3.0 - 2.0 * fraction);
  return mix(
    mix(fracture_hash(cell, frequency), fracture_hash(cell + vec2f(1.0, 0.0), frequency), blend.x),
    mix(fracture_hash(cell + vec2f(0.0, 1.0), frequency), fracture_hash(cell + vec2f(1.0), frequency), blend.x),
    blend.y
  );
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let warp = (vec2f(
    fracture_noise(uv + vec2f(0.17, 0.43), 15.0),
    fracture_noise(uv + vec2f(0.61, 0.29), 15.0)
  ) - vec2f(0.5)) * 0.65
    + (vec2f(fracture_noise(uv, 57.0), fracture_noise(uv + vec2f(0.3), 57.0)) - vec2f(0.5)) * 0.12;
  let p = uv * 24.0 + warp;
  let cell = floor(p);
  let local = fract(p);
  var first = 10.0;
  var second = 10.0;
  var first_point = vec2f(0.0);
  var second_point = vec2f(0.0);
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbor = vec2f(f32(x), f32(y));
      let delta = neighbor + cell_point(cell + neighbor) - local;
      let distance = dot(delta, delta);
      if (distance < first) {
        second = first;
        second_point = first_point;
        first = distance;
        first_point = delta;
      } else if (distance < second) {
        second = distance;
        second_point = delta;
      }
    }
  }
  let edge = sqrt(second) - sqrt(first);
  let quiet_regions = smoothstep(0.36, 0.57,
    fracture_noise(uv + vec2f(0.23, 0.51), 3.0) * 0.7 + fracture_noise(uv, 5.0) * 0.3
  );
  let segments = smoothstep(0.36, 0.51, fracture_noise(uv + warp * 0.012, 33.0));
  let presence = quiet_regions * segments;
  let width = mix(0.5, 1.65, fracture_noise(uv + vec2f(0.7, 0.2), 51.0)) * sqrt(presence);
  let vein = (1.0 - smoothstep(0.009 * width, max(0.045 * width, 0.0001), edge)) * presence;
  let hot_core = (1.0 - smoothstep(0.002 * width, max(0.013 * width, 0.0001), edge)) * presence;
  let buried_light = (1.0 - smoothstep(0.025 * width, max(0.13 * width, 0.0001), edge)) * presence;
  let heat = 0.65 + 0.55 * fracture_noise(uv + vec2f(0.41, 0.13), 12.0);
  let gold = vec3f(2.8, 2.4, 1.45) * vein * heat
    + vec3f(3.0, 2.95, 2.8) * hot_core
    + vec3f(0.15, 0.13, 0.07) * buried_light;
  let normal = second_point - first_point;
  let direction = atan2(normal.x, -normal.y);
  let orientation = fract(direction / 3.14159265);
  return vec4f(gold, orientation);
}
