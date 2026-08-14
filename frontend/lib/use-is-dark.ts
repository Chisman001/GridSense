"use client";

import { useEffect, useState } from "react";

import { THEME_CHANGED_EVENT } from "@/lib/theme";

function readIsDark(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.documentElement.classList.contains("dark");
}

export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsDark(readIsDark());
    });

    function syncTheme() {
      setIsDark(readIsDark());
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", syncTheme);
    window.addEventListener(THEME_CHANGED_EVENT, syncTheme);

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener("change", syncTheme);
      window.removeEventListener(THEME_CHANGED_EVENT, syncTheme);
      observer.disconnect();
    };
  }, []);

  return isDark;
}

export function getChartTheme(isDark: boolean) {
  return {
    grid: isDark ? "#334155" : "#e2e8f0",
    tick: isDark ? "#94a3b8" : "#64748b",
    axis: isDark ? "#475569" : "#cbd5e1",
    tooltipBg: isDark ? "#0f172a" : "#ffffff",
    tooltipBorder: isDark ? "#334155" : "#e2e8f0",
    tooltipText: isDark ? "#e2e8f0" : "#475569",
    dotFill: isDark ? "#0f172a" : "#ffffff",
  };
}
