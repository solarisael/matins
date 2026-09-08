import field_source from "../shaders/obsidian_field.wgsl";
import diffusion_source from "../shaders/obsidian_diffusion.wgsl";
import glass_source from "../shaders/obsidian_glass.wgsl";
import fog_source from "../shaders/obsidian_fog.wgsl";
import { create_obsidian_material } from "./obsidian_material.js";

const adapter_name = (info) =>
  [info.vendor, info.architecture, info.device, info.description].join(" ");

const request_hardware_adapter = async () => {
  const adapter = await navigator.gpu?.requestAdapter({
    powerPreference: "high-performance",
  });
  const unavailable = "Obsidian glass requires a hardware WebGPU adapter.";
  if (!adapter || adapter.isFallbackAdapter) throw new Error(unavailable);
  const info = adapter.info;
  if (
    info?.isFallbackAdapter ||
    /swiftshader|llvmpipe|lavapipe|software|basic render/i.test(
      adapter_name(info ?? {}),
    )
  ) {
    throw new Error(unavailable);
  }
  return adapter;
};

export const create_obsidian_gpu = async (canvas, { on_error }) => {
  const adapter = await request_hardware_adapter();
  const api = await import("vgpu");
  const device = await adapter.requestDevice({ label: "obsidian-tablet" });
  let gpu, surface, remove_error;
  let disposed = false;
  let failure = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    remove_error?.();
    surface?.dispose();
    gpu?.dispose();
    device.destroy();
  };
  const fail = (error) => {
    if (disposed || failure) return;
    failure = error;
    dispose();
    on_error(error);
  };
  try {
    gpu = await api.initFromDevice(device);
    remove_error = gpu.onError(fail);
    device.lost.then(fail);
    const format = navigator.gpu.getPreferredCanvasFormat();
    const material = await create_obsidian_material(
      api,
      gpu,
      {
        field: field_source,
        diffusion: diffusion_source,
        glass: glass_source,
        fog: fog_source,
      },
      format,
    );
    await gpu.settled();
    if (failure) throw failure;
    surface = api.surface(gpu, canvas, {
      dpr: [1, 1.25],
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
    });
    return {
      render(values) {
        if (disposed) throw new Error("Obsidian GPU is disposed.");
        material.render(surface, values);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
};
