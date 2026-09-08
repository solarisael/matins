import { prepareWithSegments, measureNaturalWidth } from "@chenglou/pretext";
import { create_inscription } from "./inscription.js";

export const size_inscription = (label, original) => {
  const style = getComputedStyle(label);
  if (!style.font) return;
  const text =
    style.textTransform === "uppercase"
      ? original.toLocaleUpperCase()
      : style.textTransform === "lowercase"
        ? original.toLocaleLowerCase()
        : original;
  const prepared = prepareWithSegments(text, style.font, {
    whiteSpace: "pre-wrap",
    letterSpacing: Number.parseFloat(style.letterSpacing) || 0,
  });
  const previous_size = label.style.inlineSize;
  label.style.inlineSize = `${measureNaturalWidth(prepared)}px`;
  return () => {
    label.style.inlineSize = previous_size;
  };
};

export const define_inscription_element = () => {
  if (customElements.get("sol-inscription")) return;
  customElements.define(
    "sol-inscription",
    class extends HTMLElement {
      connectedCallback() {
        if (this.hasAttribute("manual") || this.controller) return;
        const label = this.querySelector("[data-inscription-text]");
        if (!label) return;
        this.controller = create_inscription(label, {
          trigger: this.closest("a, button") ?? this,
          is_enabled: () =>
            this.isConnected &&
            !this.closest(
              '[inert], [hidden], [aria-hidden="true"], dialog:not([open])',
            ),
          prepare_label: size_inscription,
        });
      }
      disconnectedCallback() {
        this.controller?.dispose();
        this.controller = null;
      }
    },
  );
};
