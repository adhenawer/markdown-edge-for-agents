export { createMarkdownWorker } from "./worker/factory.js";
export { convertHtmlToMarkdown } from "./converter/index.js";
export { resolveConfig } from "./config/resolve.js";
export { presets } from "./presets/index.js";
export { KNOWN_AI_CRAWLERS } from "./worker/negotiate.js";
export type {
  UserConfig,
  ResolvedConfig,
  PresetName,
} from "./config/types.js";
