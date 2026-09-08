import ink_source from "../shaders/portal_ink.wgsl";

export const create_ink_gpu = (canvas, values, lifecycle) => {
  let gpu = null,
    surface = null,
    shader = null;
  let submit_frame = null;
  let pending = false;
  let remove_error_listener = null;

  const release = () => {
    remove_error_listener?.();
    remove_error_listener = null;
    surface?.dispose();
    surface = null;
    gpu?.dispose();
    gpu = null;
    shader = null;
  };
  const device_lost = (info) => {
    if (!lifecycle.disposed() && !lifecycle.failed()) lifecycle.fail(info);
  };
  const setup = (api, context) => {
    gpu = context;
    remove_error_listener = gpu.onError(lifecycle.fail);
    gpu.gpu.lost.then(device_lost);
    surface = api.surface(gpu, canvas, {
      dpr: [1, 1.25],
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
    });
    shader = api.effect(gpu, ink_source, {
      label: "portal-ink",
      set: { ink: values },
    });
  };
  const initialize = async () => {
    if (pending || gpu || lifecycle.failed() || lifecycle.disposed()) return;
    pending = true;
    lifecycle.loading();
    try {
      const api = await import("vgpu");
      if (lifecycle.disposed()) return;
      const context = await api.init();
      if (lifecycle.disposed()) {
        context.dispose();
        return;
      }
      setup(api, context);
      await shader.compile({
        colors: [navigator.gpu.getPreferredCanvasFormat()],
      });
      submit_frame = () =>
        api.frame(gpu, (current) => current.pass(surface, shader));
      if (lifecycle.disposed() || lifecycle.failed()) return;
      lifecycle.ready();
    } catch (error) {
      lifecycle.fail(error);
    } finally {
      pending = false;
    }
  };
  return {
    initialize,
    release,
    ready: () => Boolean(shader),
    submit() {
      shader.set({ ink: values });
      submit_frame();
    },
  };
};
