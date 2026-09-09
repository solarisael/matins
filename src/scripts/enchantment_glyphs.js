import { WATER_TRANSMISSION } from "./water_optics.js";

export const RUNIC_GLYPHS = [..."ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛈᛇᛉᛋᛏᛒᛖᛗᛚᛜᛟᛞ"];
export const SYMBOL_GLYPHS = [..."☽☿♀♂♃♄♁♆♇⚹⚺⚻⚼🜁🜂🜃🜄🜍🜔🜚🜛"];

const alphabet = [
  ...RUNIC_GLYPHS.map((text) => ({ text, family: "runic" })),
  ...SYMBOL_GLYPHS.map((text) => ({ text, family: "symbols" })),
];

export const refresh_enchanted_glyph = (node) => {
  const glyph = alphabet[Math.floor(Math.random() * alphabet.length)];
  node.dataset.glyphFamily = glyph.family;
  node.firstElementChild.textContent = glyph.text;
};

export const create_enchanted_glyph = () => {
  const node = document.createElement("span");
  node.className = "sol__enchanted_glyph";
  node.style.setProperty("--water-transmission", WATER_TRANSMISSION.near);
  const projection = document.createElement("span");
  projection.dataset.depthGlyph = "";
  projection.className = "sol__depth_glyph";
  node.append(projection);
  refresh_enchanted_glyph(node);
  return node;
};

export const load_enchantment_fonts = async () => {
  const faces = await Promise.all([
    document.fonts.load('16px "Solarisael Runic"', RUNIC_GLYPHS.join("")),
    document.fonts.load('16px "Solarisael Symbols"', SYMBOL_GLYPHS.join("")),
  ]);
  await document.fonts.ready;
  if (faces.some((family) => family.length === 0)) {
    throw new Error("The enchanted alphabet requires its bundled fonts.");
  }
};
