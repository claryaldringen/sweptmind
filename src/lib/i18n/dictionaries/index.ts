import type { Dictionary } from "../types";
import type { Locale } from "../locales";
import { cs } from "./cs";
import { en } from "./en";
import { de } from "./de";
import { it } from "./it";
import { fr } from "./fr";
import { es } from "./es";

/** Server-safe — server components import this rather than the "use client" i18n module. */
export const dictionaries: Record<Locale, Dictionary> = { cs, en, de, it, fr, es };
