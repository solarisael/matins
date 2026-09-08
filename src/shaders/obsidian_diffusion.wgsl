struct Diffusion {
  step: vec2f,
}
@group(0) @binding(0) var source_field: texture_2d<f32>;
@group(0) @binding(1) var field_sampler: sampler;
@group(0) @binding(2) var<uniform> diffusion: Diffusion;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color = vec3f(0.0);
  var total = 0.0;
  for (var offset = -21; offset <= 21; offset++) {
    let distance = f32(offset);
    let weight = exp(-distance * distance / 98.0);
    color += textureSampleLevel(source_field, field_sampler, uv + diffusion.step * distance, 0.0).rgb * weight;
    total += weight;
  }
  return vec4f(color / total, 1.0);
}
