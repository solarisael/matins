struct Glass {
  resolution: vec2f,
  tablet_size: vec2f,
  tablet_origin: vec2f,
  field_offset: vec2f,
  halo: f32,
  rim: f32,
  time: f32,
}
@group(0) @binding(0) var fracture_field: texture_2d<f32>;
@group(0) @binding(1) var diffuse_field: texture_2d<f32>;
@group(0) @binding(2) var field_sampler: sampler;
@group(0) @binding(3) var<uniform> glass: Glass;
@group(0) @binding(4) var emission_field: texture_2d<f32>;
@group(0) @binding(5) var fog_field: texture_2d<f32>;

fn film(color: vec3f) -> vec3f {
  return vec3f(1.0) - exp(-color);
}

// Keep optical distances in the original units while the baked world spans three tiles.
fn fracture_at(uv: vec2f) -> vec4f {
  return textureSampleLevel(fracture_field, field_sampler, uv / 3.0 + glass.field_offset, 0.0);
}

fn diffuse_at(uv: vec2f) -> vec3f {
  return textureSampleLevel(diffuse_field, field_sampler, uv / 3.0 + glass.field_offset, 0.0).rgb;
}

fn emission_at(uv: vec2f) -> vec3f {
  return textureSampleLevel(emission_field, field_sampler, uv / 3.0 + glass.field_offset, 0.0).rgb;
}

fn emission_energy(uv: vec2f) -> f32 {
  let light = emission_at(uv);
  return max(max(light.r, light.g), light.b);
}

fn fracture_lean(uv: vec2f, normal: vec2f, tangent: vec2f) -> f32 {
  let angle = fracture_at(uv).a * 3.14159265;
  let direction = vec2f(cos(angle), sin(angle));
  let outward = select(direction, -direction, dot(direction, normal) < 0.0);
  return clamp(dot(outward, tangent) / max(dot(outward, normal), 0.3), -0.65, 0.65);
}

fn smoke_field(world_uv: vec2f) -> vec3f {
  let mist_uv = world_uv * 2.1 + vec2f(glass.time * -0.007, glass.time * 0.01);
  let layers = textureSampleLevel(fog_field, field_sampler, mist_uv, 0.0).rgb;
  let fold_uv = world_uv * 0.9 + vec2f(0.37, 0.19)
    + vec2f(glass.time * 0.004, glass.time * -0.006)
    + (layers.rg - vec2f(0.5)) * 0.12;
  let folds = textureSampleLevel(fog_field, field_sampler, fold_uv, 0.0).rg;
  let density = smoothstep(0.34, 0.67, mix(layers.r, folds.g, 0.4));
  let tide = 0.5 + 0.5 * sin(glass.time * 0.23 + folds.r * 8.0 + layers.b * 4.0);
  return vec3f(density, folds.r, tide);
}

fn atmosphere(field_uv: vec2f, energy: f32, diffused: vec3f, distance: f32) -> vec4f {
  let world_uv = field_uv - vec2f(glass.time * 0.012, glass.time * -0.007)
    + (glass.tablet_origin + glass.tablet_size * 0.5) / 640.0;
  let smoke = smoke_field(world_uv);
  let reach = max(glass.halo, 1.0);
  let wave = 0.5 + 0.5 * sin(distance / reach * 7.0 - glass.time * 0.37 + smoke.y * 9.0);
  let density = smoke.x * mix(0.45, 1.0, smoothstep(0.2, 0.8, wave));
  let envelope = exp(-distance / (reach * 0.55));
  let illumination = smoothstep(0.04, 0.7, energy);
  let scattered = density * envelope * illumination * mix(0.35, 0.65, smoke.z);
  let shadow = density * envelope * (1.0 - illumination) * 0.28;
  let tint = mix(vec3f(0.95, 0.92, 0.8), film(diffused * 4.0), 0.25);
  return vec4f(tint * scattered, scattered + shadow * (1.0 - scattered));
}

fn basin_surface(
  local: vec2f, edge_distance: f32, edge_normal: vec2f,
  field_uv: vec2f, diffused: vec3f
) -> vec3f {
  let inner_distance = edge_distance - glass.rim;
  let wall_width = clamp(min(glass.tablet_size.x, glass.tablet_size.y) * 0.075, 14.0, 36.0);
  let wall_progress = clamp(inner_distance / wall_width, 0.0, 1.0);
  let depth = smoothstep(0.0, 1.0, wall_progress);
  let slope = sin(wall_progress * 3.14159265);
  let ripple = vec2f(
    sin(local.y * 0.023 + glass.time * 0.17 + sin(local.x * 0.009)),
    cos(local.x * 0.019 - glass.time * 0.13 + sin(local.y * 0.011))
  );
  let curved_uv = field_uv - edge_normal * slope * 0.035
    + vec2f(0.0, depth * 0.018) + ripple * mix(0.004, 0.009, depth);
  let transmission = fracture_at(curved_uv).rgb;
  let reflection = fracture_at(field_uv + edge_normal * slope * 0.024 - ripple * 0.005).rgb;
  let red = fracture_at(curved_uv + ripple * 0.001).r;
  let blue = fracture_at(curved_uv - ripple * 0.001).b;
  let inward_light = max(dot(-edge_normal, normalize(vec2f(-0.6, -0.8))), 0.0);
  let edge_glint = exp(-inner_distance / 1.1)
    + exp(-abs(inner_distance - wall_width) / 1.2);
  let contact_shadow = exp(-inner_distance / (wall_width * 0.7))
    * mix(0.5, 0.2, inward_light);
  let fresnel = 0.07 + edge_glint * 0.3;
  let stone = mix(vec3f(0.009, 0.007, 0.015), vec3f(0.004, 0.005, 0.009), depth);
  let radiance = stone + vec3f(red, transmission.g, blue) * mix(0.56, 0.38, depth)
    + reflection * fresnel * 0.45 + diffused * 0.08
    + vec3f(0.12, 0.115, 0.1) * edge_glint
      * smoothstep(0.06, 0.5, emission_energy(curved_uv));
  let glass_color = film(radiance) * (1.0 - contact_shadow) * (1.0 - slope * 0.18);

  // The lip hides the crossing smoke; the same world field feeds both sides.
  let world_uv = (glass.tablet_origin + local) / 640.0;
  let smoke = smoke_field(world_uv + edge_normal * inner_distance / 1600.0);
  let crest = smoothstep(0.58, 0.94, smoke.z);
  let reach = max(glass.halo, 1.0) * mix(0.3, 3.0, crest);
  let spill = exp(-inner_distance / reach)
    * (1.0 - smoothstep(reach * 0.7, reach * 1.5, inner_distance));
  let lip_occlusion = smoothstep(0.0, wall_width * 0.45, inner_distance);
  let density = smoke.x * crest * spill * lip_occlusion;
  let illumination = smoothstep(0.04, 0.7, emission_energy(curved_uv));
  let scattered = density * illumination * 0.32;
  let shadow = density * (1.0 - illumination) * 0.48;
  let tint = mix(vec3f(0.95, 0.92, 0.8), film(diffused * 4.0), 0.25);
  return glass_color * (1.0 - shadow) * (1.0 - scattered) + tint * scattered;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let pixel = uv * glass.resolution;
  let origin = glass.tablet_origin;
  let local = pixel - origin;
  let half_size = glass.tablet_size * 0.5;
  let centered = local - half_size;
  let outside = max(abs(centered) - half_size, vec2f(0.0));
  let outside_distance = length(outside);
  if (outside_distance > max(glass.halo, 1.0) * 4.0) {
    return vec4f(0.0);
  }
  let drift = vec2f(glass.time * 0.012, glass.time * -0.007);
  let field_uv = centered / 640.0 + drift;
  let diffused = diffuse_at(field_uv);


  let surface_local = clamp(local, vec2f(0.0), glass.tablet_size);
  let surface_centered = surface_local - half_size;
  let edge_pair = min(surface_local, glass.tablet_size - surface_local);
  let edge_distance = min(edge_pair.x, edge_pair.y);
  let bevel = 1.0 - smoothstep(0.0, max(glass.rim * 0.85, 1.0), edge_distance);
  let edge_normal = normalize(vec2f(
    sign(surface_centered.x) * exp(-edge_pair.x / 5.0),
    sign(surface_centered.y) * exp(-edge_pair.y / 5.0)
  ) + vec2f(0.00001));
  let ripple = vec2f(
    sin(surface_local.y * 0.032 + sin(surface_local.x * 0.015)),
    cos(surface_local.x * 0.029 + sin(surface_local.y * 0.018))
  );
  let refraction = surface_centered / 640.0 + drift
    + edge_normal * bevel * 0.022 + ripple * 0.006;

  if (outside_distance > 0.0) {
    let tangent = vec2f(-edge_normal.y, edge_normal.x);
    let first_lean = fracture_lean(refraction, edge_normal, tangent);
    let estimate = refraction - tangent * outside_distance * first_lean / 640.0;
    let lean = fracture_lean(estimate, edge_normal, tangent);
    let jet_uv = refraction - tangent * outside_distance * lean / 640.0;
    let edge_light = emission_at(jet_uv);
    let energy = max(max(edge_light.r, edge_light.g), edge_light.b);
    let mist = atmosphere(
      field_uv, emission_energy(mix(refraction, field_uv, 0.35)), diffused, outside_distance
    );
    let center_log = log(max(energy, 0.0001));
    let minus_log = log(max(emission_energy(jet_uv - tangent * 3.0 / 640.0), 0.0001));
    let plus_log = log(max(emission_energy(jet_uv + tangent * 3.0 / 640.0), 0.0001));
    let curvature = (plus_log - 2.0 * center_log + minus_log) / 9.0;
    if (curvature >= -0.001 || energy < 0.015) {
      return mist;
    }
    let gradient = (plus_log - minus_log) / 6.0;
    let axis_offset = -gradient / curvature;
    if (abs(axis_offset) > 18.0) {
      return mist;
    }
    let peak = exp(min(center_log - 0.5 * gradient * gradient / curvature, 2.0));
    let emission = smoothstep(0.04, 0.85, peak);
    let reach = max(2.0, glass.halo * mix(0.1, 0.6, sqrt(emission)));
    let progress = outside_distance / reach;
    if (progress >= 1.0) {
      return mist;
    }
    let core_half_width = mix(0.7, 0.2, progress);
    let filament = 1.0 - smoothstep(
      max(0.0, core_half_width - 0.2), core_half_width + 0.2, abs(axis_offset)
    );
    let light = mix(
      film((edge_light * 0.95 + diffused * 0.05) * 3.4),
      vec3f(1.0, 0.985, 0.94),
      0.75
    );
    let grain_cell = floor(field_uv * 800.0);
    let grain = fract(sin(dot(grain_cell, vec2f(12.9898, 78.233))) * 43758.5453);
    let density = mix(0.84, 1.0, grain);
    let fade = (1.0 - progress * 0.3) * (1.0 - smoothstep(0.85, 1.0, progress));
    let core_alpha = min(0.98, filament * sqrt(emission) * density * fade * 1.1);

    let wake_profile = exp(-abs(axis_offset) / 1.8) * (1.0 - progress);
    let shimmer = sin(dot(field_uv, vec2f(155.0, 231.0)) + progress * 5.0);
    let bend = tangent * shimmer * wake_profile * 0.008
      + edge_normal * wake_profile * 0.003;
    let through = fracture_at(field_uv + bend).rgb;
    let behind = fracture_at(field_uv).rgb;
    let glint = film(abs(through - behind) * 0.8);
    let broken = smoothstep(0.3, 0.85, 0.5 + shimmer * 0.5);
    let wake_strength = wake_profile * emission * density * broken * fade * 0.1;
    let aura = exp(-abs(axis_offset) / 1.0) * emission * fade * 0.1;
    let wake_color = glint * wake_strength + light * aura;
    let wake_alpha = max(max(glint.r, glint.g), glint.b) * wake_strength + aura;
    let color = light * core_alpha + wake_color * (1.0 - core_alpha);
    let alpha = core_alpha + wake_alpha * (1.0 - core_alpha);
    return vec4f(color + mist.rgb * (1.0 - alpha), alpha + mist.a * (1.0 - alpha));
  }

  if (edge_distance > glass.rim) {
    return vec4f(basin_surface(local, edge_distance, edge_normal, field_uv, diffused), 1.0);
  }

  let transmitted = fracture_at(refraction).rgb;
  let reflection_uv = field_uv - edge_normal * bevel * 0.035 - ripple * 0.004;
  let reflected = fracture_at(reflection_uv).rgb;
  let red = fracture_at(refraction + edge_normal * 0.0015).r;
  let blue = fracture_at(refraction - edge_normal * 0.0015).b;
  let depth = vec3f(red, transmitted.g, blue);
  let fresnel = 0.08 + 0.5 * pow(bevel, 3.0);
  let highlight = pow(max(dot(edge_normal, normalize(vec2f(-0.6, -0.8))), 0.0), 5.0) * bevel;
  let stone = vec3f(0.007, 0.005, 0.012) + vec3f(0.025, 0.018, 0.035) * (0.5 + ripple.x * 0.5);
  let radiance = stone + depth * (0.7 - fresnel * 0.35)
    + reflected * fresnel * 0.55 + diffused * 0.11
    + vec3f(0.28, 0.23, 0.33) * highlight;
  return vec4f(film(radiance), 1.0);
}
