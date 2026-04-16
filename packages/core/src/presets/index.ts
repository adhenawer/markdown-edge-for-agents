import { astroPreset } from "./astro.js";
import { customPreset } from "./custom.js";
import { hugoPreset } from "./hugo.js";

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
