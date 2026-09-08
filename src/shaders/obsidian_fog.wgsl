fn fog_hash(point: vec2f, period: f32) -> f32 {
  let wrapped = point - floor(point / period) * period;
  return fract(sin(dot(wrapped, vec2f(127.1, 311.7))) * 43758.5453);
}

fn fog_noise(uv: vec2f, frequency: f32) -> f32 {
  let p = uv * frequency;
  let cell = floor(p);
  let fraction = fract(p);
  let blend = fraction * fraction * (3.0 - 2.0 * fraction);
  let lower = mix(fog_hash(cell, frequency), fog_hash(cell + vec2f(1.0, 0.0), frequency), blend.x);
  let upper = mix(fog_hash(cell + vec2f(0.0, 1.0), frequency), fog_hash(cell + vec2f(1.0), frequency), blend.x);
  return mix(lower, upper, blend.y);
}

fn fog_layers(uv: vec2f) -> f32 {
  return fog_noise(uv, 4.0) * 0.53
    + fog_noise(uv, 8.0) * 0.27
    + fog_noise(uv, 16.0) * 0.13
    + fog_noise(uv, 32.0) * 0.07;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return vec4f(fog_layers(uv), fog_layers(uv + vec2f(0.37, 0.61)), fog_noise(uv, 2.0), 1.0);
}
