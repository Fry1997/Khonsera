export type { JourneyTheme, MapThemeColors } from "./types";
export { dusk } from "./dusk";
export { midnight } from "./midnight";
export { sahara } from "./sahara";
export { cotton } from "./cotton";

import { dusk } from "./dusk";
import { midnight } from "./midnight";
import { sahara } from "./sahara";
import { cotton } from "./cotton";
import type { JourneyTheme } from "./types";

export const THEMES: Record<string, JourneyTheme> = {
  dusk,
  midnight,
  sahara,
  cotton,
};
