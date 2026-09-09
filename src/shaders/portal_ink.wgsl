import { simplex3d, fbmSimplex3d } from "@vgpu/wgsl-std/noise/simplex";
import { linearToSrgb3 } from "@vgpu/wgsl-std/color";

struct Ink {
  resolution: vec2f,
  center: vec2f,
  extent: vec2f,
  time: f32,
  reveal: f32,
  sdr: f32,
}
@group(0) @binding(0) var<uniform> ink: Ink;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = ink.resolution.x / max(ink.resolution.y, 1.0);
  let p = (uv - ink.center) * vec2f(aspect, 1.0);
  let drift = ink.time * 0.07;
  let current = vec2f(
    fbmSimplex3d(vec3f(p * 1.65, drift), 3, 2.0, 0.5),
    fbmSimplex3d(vec3f(p * 1.65 + vec2f(13.7, 8.2), drift + 4.3), 3, 2.0, 0.5)
  );
  let warped = p + current * 0.12 * min(aspect, 1.0);
  let normalized = abs(warped / max(ink.extent, vec2f(0.001)));
  let radius = pow(pow(normalized.x, 3.0) + pow(normalized.y, 3.0), 1.0 / 3.0);
  let body = fbmSimplex3d(vec3f(warped * 3.4 + current * 0.8, drift * 0.6), 3, 2.0, 0.5);
  let eddies = simplex3d(vec3f(warped * 8.0 + current * 2.2, drift * 0.45));
  let spread = mix(0.015, 1.0, smoothstep(0.0, 1.0, ink.reveal));
  let edge = radius - spread + body * 0.18 + eddies * 0.035;
  let dense = 1.0 - smoothstep(-0.035, 0.035, edge);
  let wash = 1.0 - smoothstep(-0.015, 0.20, edge + body * 0.05);
  let pigment = clamp(dense * 0.98 + wash * 0.22, 0.0, 0.995);
  let wet_edge = max(wash - dense, 0.0) * 0.012;
  let color = vec3f(0.001, 0.0015, 0.0025)
    + vec3f(0.45, 0.55, 0.65) * wet_edge
    + vec3f(0.002, 0.003, 0.004) * clamp(body + 0.5, 0.0, 1.0);
  // Match the basin's 42% SDR lift before alpha multiplication.
  let display = mix(color, linearToSrgb3(color), ink.sdr * 0.42);
  return vec4f(display * pigment, pigment);
}
