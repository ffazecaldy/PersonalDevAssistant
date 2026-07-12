"use client";

import { useCallback, useSyncExternalStore } from "react";
import { z } from "zod";

const STORAGE_KEY = "command-center-settings";

export const settingsSchema = z.object({
  theme: z.enum(["dark", "light"]).default("dark"),
  ollamaEndpoint: z.string().default("http://localhost:11434"),
  ollamaModel: z.string().default("gemma4:31b-cloud"),
  defaultTaskView: z.enum(["list", "board", "calendar"]).default("list"),
  calendarFirstDay: z.enum(["0", "1"]).default("1"),
  language: z.enum(["it", "en"]).default("it"),
});

export type Settings = z.infer<typeof settingsSchema>;

let cachedSettings: Settings | null = null;

function getSnapshot(): Settings {
  if (typeof window === "undefined") return getServerSnapshot();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getServerSnapshot();
    const parsed = settingsSchema.parse(JSON.parse(raw));
    // Return cached reference if value hasn't changed (prevents infinite loop)
    if (cachedSettings && JSON.stringify(cachedSettings) === JSON.stringify(parsed)) {
      return cachedSettings;
    }
    cachedSettings = parsed;
    return parsed;
  } catch {
    return getServerSnapshot();
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

let cachedServerSettings: Settings | null = null;

function getServerSnapshot(): Settings {
  if (!cachedServerSettings) {
    cachedServerSettings = settingsSchema.parse({});
  }
  return cachedServerSettings;
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    const current = getSnapshot();
    const merged = { ...current, ...partial };
    const validated = settingsSchema.parse(merged);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    // Dispatch a custom event so other tabs/hooks can react
    window.dispatchEvent(new Event("storage"));
  }, []);

  return { settings, updateSettings };
}
