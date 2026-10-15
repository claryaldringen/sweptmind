import type { Locale } from "@/lib/i18n/locales";
import type { GtdContent } from "./types";
import { cs } from "./cs";
import { en } from "./en";
import { de } from "./de";
import { it } from "./it";
import { fr } from "./fr";
import { es } from "./es";

export const gtdContent: Record<Locale, GtdContent> = { cs, en, de, it, fr, es };
