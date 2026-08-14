export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "gridsense-theme";
export const THEME_CHANGED_EVENT = "gridsense:theme-changed";

export type ThemeChangedDetail = {
  preference: ThemePreference;
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return "system";
}

export function resolveDarkMode(preference: ThemePreference): boolean {
  if (preference === "dark") {
    return true;
  }

  if (preference === "light") {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(preference: ThemePreference): boolean {
  const isDark = resolveDarkMode(preference);

  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";

  if (preference === "system") {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }

  return isDark;
}

export function setThemePreference(preference: ThemePreference): boolean {
  const isDark = applyTheme(preference);

  window.dispatchEvent(
    new CustomEvent<ThemeChangedDetail>(THEME_CHANGED_EVENT, {
      detail: { preference },
    })
  );

  return isDark;
}
