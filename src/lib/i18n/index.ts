"use client";

import { createContext, useContext } from "react";
import type { Dictionary, Locale } from "./types";
import { cs } from "./dictionaries/cs";
import { en } from "./dictionaries/en";

export const dictionaries: Record<Locale, Dictionary> = { cs, en };

type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;
type TranslateArrayFunction = (key: string) => string[];

const I18nContext = createContext<{
  t: TranslateFunction;
  tArray: TranslateArrayFunction;
  locale: Locale;
}>({
  t: (key) => key,
  tArray: () => [],
  locale: "cs",
});

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

function getNestedArray(obj: Record<string, unknown>, path: string): string[] {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return [];
    current = (current as Record<string, unknown>)[key];
  }
  return Array.isArray(current) ? (current as string[]) : [];
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

export function createTranslate(locale: Locale): {
  t: TranslateFunction;
  tArray: TranslateArrayFunction;
} {
  const dict = dictionaries[locale];
  const t = (key: string, params?: Record<string, string | number>) => {
    const value = getNestedValue(dict as unknown as Record<string, unknown>, key);
    return interpolate(value, params);
  };
  const tArray = (key: string) => {
    return getNestedArray(dict as unknown as Record<string, unknown>, key);
  };
  return { t, tArray };
}

export function useTranslations() {
  return useContext(I18nContext);
}

export { I18nContext };
export type { Dictionary, Locale };
