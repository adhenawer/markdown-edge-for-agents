import { astroPreset } from "./astro.js";
import { hugoPreset } from "./hugo.js";
import { customPreset } from "./custom.js";

export const presets = {
  astro: astroPreset,
  hugo: hugoPreset,
  custom: customPreset,
} as const;

export type PresetConfig = {
  selector: string;
  strip: readonly string[];
  frontmatter: readonly string[];
};
