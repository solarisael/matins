import { create_gpu_effect_runtime } from "./gpu_effect_runtime.js";
import { register_node_disposal } from "./node_disposal_bridge.js";
import { create_ink_shadow } from "./portal_ink.js";
import { create_portal_inscriptions } from "./portal_inscriptions.js";

const mounted = new WeakSet();

const create_portal_effect = ({ three, renderer }, menu, aperture) => {
  const chamber = new three.Scene();
  chamber.background = new three.Color("#070a0f");
  chamber.fog = new three.FogExp2("#070a0f", 0.044);
  const camera = new three.PerspectiveCamera(43, 1, 0.1, 100);
  const architecture = new three.Group();
  chamber.add(architecture);
  const resources = [];
  const line_material = new three.LineBasicMaterial({
    color: "#b89a59",
    transparent: true,
    opacity: 0.3,
  });
  const fine_material = new three.LineBasicMaterial({
    color: "#e1bb6c",
    transparent: true,
    opacity: 0.13,
  });
  resources.push(line_material, fine_material);
  const lines = [];
  for (let layer = 0; layer < 9; layer++) {
    const z = -layer * 4;
    const w = 5.4,
      h = 3.8;
    lines.push(
      -w,
      -h,
      z,
      w,
      -h,
      z,
      w,
      -h,
      z,
      w,
      h,
      z,
      w,
      h,
      z,
      -w,
      h,
      z,
      -w,
      h,
      z,
      -w,
      -h,
      z,
    );
  }
  for (const x of [-5.4, -3.4, 3.4, 5.4]) {
    for (const y of [-3.8, 3.8]) lines.push(x, y, 0, x, y, -38);
  }
  const frame_geometry = new three.BufferGeometry();
  frame_geometry.setAttribute(
    "position",
    new three.Float32BufferAttribute(lines, 3),
  );
  resources.push(frame_geometry);
  architecture.add(new three.LineSegments(frame_geometry, line_material));
  const glyph_lines = [];
  for (let i = 0; i < 32; i++) {
    const x = Math.sin(i * 2.39) * 4.6;
    const y = Math.cos(i * 1.73) * 3.2;
    const z = -3 - (i % 8) * 4;
    glyph_lines.push(
      x,
      y,
      z,
      x + 0.3 + (i % 3) * 0.18,
      y,
      z,
      x,
      y,
      z,
      x,
      y + 0.15,
      z,
    );
  }
  const inscription_geometry = new three.BufferGeometry();
  inscription_geometry.setAttribute(
    "position",
    new three.Float32BufferAttribute(glyph_lines, 3),
  );
  resources.push(inscription_geometry);
  architecture.add(new three.LineSegments(inscription_geometry, fine_material));

  const mote_geometry = new three.IcosahedronGeometry(0.022, 0);
  const mote_material = new three.MeshBasicMaterial({
    color: "#edcc83",
    transparent: true,
    opacity: 0.65,
  });
  resources.push(mote_geometry, mote_material);
  const motes = new three.InstancedMesh(mote_geometry, mote_material, 64);
  const transform = new three.Object3D();
  chamber.add(motes);
  let disposed = false;
  let pixel_width = 1,
    pixel_height = 1,
    pixel_ratio = 1;
  let pointer_x = 0,
    pointer_y = 0;
  renderer.autoClear = false;

  return {
    resize({ width, height, dpr }) {
      pixel_width = width;
      pixel_height = height;
      pixel_ratio = dpr;
    },
    render({ elapsed_seconds }) {
      if (disposed || menu.dataset.sideMenuOpen !== "true") return;
      const shell = aperture.parentElement;
      const outer = shell.getBoundingClientRect();
      const canvas_bounds = renderer.domElement.getBoundingClientRect();
      const edge = shell.clientLeft;
      const rect = {
        left: outer.left - canvas_bounds.left + edge,
        top: outer.top - canvas_bounds.top + edge,
        right: outer.right - canvas_bounds.left - edge,
        bottom: outer.bottom - canvas_bounds.top - edge,
        width: outer.width - edge * 2,
        height: outer.height - edge * 2,
      };
      const width = pixel_width / pixel_ratio,
        height = pixel_height / pixel_ratio;
      renderer.setClearColor(0x000000, 0);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.clear();
      const left = Math.max(0, rect.left),
        top = Math.max(0, rect.top);
      const right = Math.min(width, rect.right),
        bottom = Math.min(height, rect.bottom);
      if (right <= left || bottom <= top) return;
      renderer.setViewport(
        rect.left,
        height - rect.bottom,
        rect.width,
        rect.height,
      );
      renderer.setScissor(left, height - bottom, right - left, bottom - top);
      renderer.setScissorTest(true);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      const style = getComputedStyle(menu);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const target_x = reduced
        ? 0
        : Number(style.getPropertyValue("--portal-pointer-x")) || 0;
      const target_y = reduced
        ? 0
        : Number(style.getPropertyValue("--portal-pointer-y")) || 0;
      pointer_x += (target_x - pointer_x) * 0.065;
      pointer_y += (target_y - pointer_y) * 0.065;
      camera.position.set(pointer_x * 0.55 - 1.2, -pointer_y * 0.4, 8);
      camera.lookAt(1.8 + pointer_x * 0.14, -pointer_y * 0.1, -20);
      for (let i = 0; i < 64; i++) {
        transform.position.set(
          Math.sin(i * 3.17) * 5,
          Math.cos(i * 2.71) * 3.5 +
            Math.sin(elapsed_seconds * 0.16 + i) * 0.12,
          -((i * 1.618 + elapsed_seconds * 0.12) % 34),
        );
        transform.updateMatrix();
        motes.setMatrixAt(i, transform.matrix);
      }
      motes.instanceMatrix.needsUpdate = true;
      renderer.render(chamber, camera);
      renderer.setScissorTest(false);
    },
    dispose() {
      disposed = true;
      motes.dispose();
      resources.forEach((resource) => resource.dispose());
    },
  };
};

const mount_portal = () => {
  const menu = document.querySelector("#sol_side_menu");
  if (!menu || mounted.has(menu)) return;
  mounted.add(menu);
  const panel = menu.querySelector("dialog");
  const canvas = menu.querySelector("[data-portal-canvas]");
  const aperture = menu.querySelector("[data-portal-aperture]");
  if (!panel || !canvas || !aperture) return;
  const ink = create_ink_shadow(
    menu,
    panel,
    menu.querySelector("[data-portal-ink]"),
    aperture.parentElement,
  );
  let disposed = false,
    pending = false,
    failed = false,
    runtime = null;
  const inscriptions = create_portal_inscriptions(menu);
  const synchronize = async () => {
    if (menu.dataset.sideMenuOpen !== "true") {
      inscriptions.restore();
      ink.close();
      return;
    }
    ink.open();
    if (menu.dataset.portalPhase === "artifact") inscriptions.reveal();
    if (runtime) {
      runtime.invalidate();
      return;
    }
    if (pending || failed || disposed) return;
    pending = true;
    menu.dataset.portalRenderer = "loading";
    try {
      runtime = await create_gpu_effect_runtime({
        owner: panel,
        canvas,
        create_effect: (modules) =>
          create_portal_effect(modules, menu, aperture),
        is_owner_alive: () => !disposed && menu.isConnected,
        maximum_frame_rate: 30,
        dpr_cap: 1.5,
        on_first_frame: (backend) => {
          menu.dataset.portalRenderer = backend;
        },
        on_error: (error) => {
          failed = true;
          menu.dataset.portalRenderer = "unavailable";
          console.warn(
            "Portal scene unavailable; navigation remains usable.",
            error,
          );
        },
      });
    } catch (error) {
      failed = true;
      menu.dataset.portalRenderer = "unavailable";
      console.warn(
        "Portal scene unavailable; navigation remains usable.",
        error,
      );
    } finally {
      pending = false;
    }
  };
  const observer = new MutationObserver(synchronize);
  observer.observe(menu, {
    attributes: true,
    attributeFilter: ["data-side-menu-open", "data-side-menu-view"],
  });
  const cleanup = () => {
    ink.dispose();
    disposed = true;
    observer.disconnect();
    inscriptions.dispose();
    runtime?.dispose();
  };
  register_node_disposal(menu, cleanup);
  synchronize();
};

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", mount_portal, { once: true });
else mount_portal();
document.addEventListener("htmx:afterSwap", mount_portal);
