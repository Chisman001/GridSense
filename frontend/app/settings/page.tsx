"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getStoredThemePreference,
  setThemePreference,
  THEME_CHANGED_EVENT,
  type ThemeChangedDetail,
  type ThemePreference,
} from "@/lib/theme";
import { ShellIcon } from "@/components/shell/shell-icon";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Always use the light appearance.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark appearance.",
  },
  {
    value: "system",
    label: "System",
    description: "Match your device prefers-color-scheme setting.",
  },
];

function PageHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description: string;
  eyebrow: string;
}) {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            {eyebrow}
          </p>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPreference(getStoredThemePreference());
      setHydrated(true);
    });

    function handleThemeChanged(event: Event) {
      const customEvent = event as CustomEvent<ThemeChangedDetail>;
      const nextPreference =
        customEvent.detail?.preference ?? getStoredThemePreference();
      setPreference(nextPreference);
    }

    window.addEventListener(THEME_CHANGED_EVENT, handleThemeChanged);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
    };
  }, []);

  function selectTheme(next: ThemePreference) {
    setPreference(next);
    setThemePreference(next);
  }

  return (
    <main className="overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-transparent dark:text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Settings"
          description="Control how GridSense looks on this device and jump to the workspace or account tools you already use."
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <ShellIcon name="sun" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                  Appearance
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                  Theme
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Choose light, dark, or follow your system preference. This
                  uses the same local theme setting as the application shell.
                </p>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label="Theme preference"
              className="mt-6 grid gap-3 sm:grid-cols-3"
            >
              {THEME_OPTIONS.map((option) => {
                const selected = hydrated && preference === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectTheme(option.value)}
                    className={`rounded-xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      selected
                        ? "border-emerald-600 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-400/10"
                        : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-950 dark:text-white">
                        {option.label}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          selected
                            ? "border-emerald-600 dark:border-emerald-400"
                            : "border-slate-300 dark:border-slate-500"
                        }`}
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                        )}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <ShellIcon name="briefcase" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                  Workspace
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                  Business workspace
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Your business profile controls the workspace data used
                  throughout GridSense forecasts, analytics, insights, and
                  reports.
                </p>
              </div>
            </div>

            <Link
              href="/businesses"
              className="mt-6 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <span>Manage business</span>
              <ShellIcon name="chevron" className="h-4 w-4 text-slate-400" />
            </Link>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <ShellIcon name="profile" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                  Account &amp; security
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                  Manage your account
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Password, email, sessions, and security are managed by Clerk
                  on your Profile page.
                </p>
              </div>
            </div>

            <Link
              href="/profile"
              className="mt-6 flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <span>Open profile &amp; account</span>
              <ShellIcon name="chevron" className="h-4 w-4 text-slate-400" />
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
