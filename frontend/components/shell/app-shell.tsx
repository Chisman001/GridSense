"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  applyTheme,
  getStoredThemePreference,
  resolveDarkMode,
  setThemePreference,
  THEME_CHANGED_EVENT,
  type ThemeChangedDetail,
  type ThemePreference,
} from "@/lib/theme";

import {
  bottomNavigation,
  getPageTitle,
  isNavigationActive,
  primaryNavigation,
  secondaryNavigation,
  workspaceNavigation,
  shellRoutes,
  type NavigationItem,
} from "./navigation";
import { ShellIcon } from "./shell-icon";

function ShellUserButton() {
  return (
    <UserButton
      userProfileMode="navigation"
      userProfileUrl="/profile"
    />
  );
}

type BusinessResponse = {
  business: {
    businessName?: unknown;
  } | null;
};

const BUSINESS_UPDATED_EVENT = "gridsense:business-updated";

type BusinessUpdatedDetail = {
  businessName?: unknown;
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      aria-label="GridSense dashboard"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-emerald-400 shadow-sm dark:bg-emerald-400 dark:text-slate-950">
        <ShellIcon name="bolt" className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-base font-bold tracking-tight text-slate-950 dark:text-white">
            GridSense
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Energy intelligence
          </span>
        </span>
      )}
    </Link>
  );
}

function NavigationLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isNavigationActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        active
          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-300"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-emerald-600 dark:bg-emerald-400"
        />
      )}
      <ShellIcon
        name={item.icon}
        className={`h-5 w-5 shrink-0 ${
          active
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-200"
        }`}
      />
      <span>{item.label}</span>
    </Link>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  pressed,
}: {
  label: string;
  icon: "bell" | "close" | "menu" | "moon" | "search" | "sun";
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <ShellIcon name={icon} className="h-[1.15rem] w-[1.15rem]" />
    </button>
  );
}

export function ShellBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const usesShell = shellRoutes.some(({ href }) =>
    isNavigationActive(pathname, href)
  );

  if (!usesShell) {
    return children;
  }

  return <AppShell>{children}</AppShell>;
}

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const businessMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [businessName, setBusinessName] = useState("Current workspace");
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");
  const [darkTheme, setDarkTheme] = useState(false);
  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    const initialPreference = getStoredThemePreference();
    const frame = window.requestAnimationFrame(() => {
      setThemePreferenceState(initialPreference);
      setDarkTheme(applyTheme(initialPreference));
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function syncFromSystemPreference() {
      if (getStoredThemePreference() !== "system") {
        return;
      }

      setThemePreferenceState("system");
      setDarkTheme(applyTheme("system"));
    }

    function handleThemeChanged(event: Event) {
      const customEvent = event as CustomEvent<ThemeChangedDetail>;
      const nextPreference =
        customEvent.detail?.preference ?? getStoredThemePreference();

      setThemePreferenceState(nextPreference);
      setDarkTheme(resolveDarkMode(nextPreference));
    }

    mediaQuery.addEventListener("change", syncFromSystemPreference);
    window.addEventListener(THEME_CHANGED_EVENT, handleThemeChanged);

    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener("change", syncFromSystemPreference);
      window.removeEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
    };
  }, []);

  function toggleShellTheme() {
    const nextPreference: ThemePreference = darkTheme ? "light" : "dark";
    setThemePreferenceState(nextPreference);
    setDarkTheme(setThemePreference(nextPreference));
  }

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return shellRoutes;
    }

    return shellRoutes.filter(({ label }) =>
      label.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBusiness(signal?: AbortSignal) {
      try {
        const response = await fetch("/api/business", {
          headers: { Accept: "application/json" },
          signal,
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as BusinessResponse;
        if (typeof payload.business?.businessName === "string") {
          setBusinessName(payload.business.businessName);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setBusinessName("Workspace unavailable");
        }
      }
    }

    function handleBusinessUpdated(event: Event) {
      const customEvent = event as CustomEvent<BusinessUpdatedDetail>;
      const nextName = customEvent.detail?.businessName;

      if (typeof nextName === "string" && nextName.trim()) {
        setBusinessName(nextName.trim());
        return;
      }

      void loadBusiness();
    }

    void loadBusiness(controller.signal);
    window.addEventListener(BUSINESS_UPDATED_EVENT, handleBusinessUpdated);

    return () => {
      controller.abort();
      window.removeEventListener(BUSINESS_UPDATED_EVENT, handleBusinessUpdated);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setSearchOpen(false);
        setNotificationOpen(false);
        setBusinessOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!businessOpen && !notificationOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        businessMenuRef.current?.contains(target) ||
        notificationMenuRef.current?.contains(target)
      ) {
        return;
      }

      setBusinessOpen(false);
      setNotificationOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [businessOpen, notificationOpen]);

  function openSearch() {
    setNotificationOpen(false);
    setBusinessOpen(false);
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function navigateFromSearch(href: string) {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-20 items-center border-b border-slate-100 px-5 dark:border-slate-800">
          <Logo />
        </div>

        <nav
          aria-label="Primary navigation"
          className="flex-1 overflow-y-auto px-3 py-5"
        >
          <p className="px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            Main
          </p>
          <div className="space-y-1">
            {primaryNavigation.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </div>

          <p className="mt-6 px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            Workspace
          </p>
          <div className="space-y-1">
            {workspaceNavigation.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-100 px-3 py-4 dark:border-slate-800">
          <nav aria-label="Account navigation" className="space-y-1">
            {secondaryNavigation.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/70">
            <ShellUserButton />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                Account
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Manage your profile
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur lg:h-20 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex h-16 min-w-0 items-center gap-2 px-4 sm:px-6 lg:h-20 lg:px-8">
            <div className="mr-1 lg:hidden">
              <Logo compact />
            </div>

            <div className="min-w-0 flex-1">
              <p className="hidden text-xs font-medium text-slate-400 sm:block dark:text-slate-500">
                GridSense / Workspace
              </p>
              <h1 className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-lg dark:text-white">
                {pageTitle}
              </h1>
            </div>

            <button
              type="button"
              onClick={openSearch}
              className="hidden h-10 w-full max-w-60 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-500 transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800/70"
            >
              <ShellIcon name="search" className="h-4 w-4" />
              <span className="flex-1">Search</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[0.65rem] font-semibold dark:border-slate-600 dark:bg-slate-900">
                Ctrl K
              </kbd>
            </button>

            <div className="md:hidden">
              <IconButton label="Search navigation" icon="search" onClick={openSearch} />
            </div>

            <div ref={notificationMenuRef} className="relative">
              <IconButton
                label="Notifications"
                icon="bell"
                onClick={() => {
                  setBusinessOpen(false);
                  setNotificationOpen((open) => !open);
                }}
                pressed={notificationOpen}
              />
              {notificationOpen && (
                <div
                  role="status"
                  className="absolute right-0 top-12 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                >
                  <p className="font-semibold text-slate-950 dark:text-white">
                    Notifications
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 px-4 py-5 text-center dark:bg-slate-800">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      You&apos;re all caught up
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      New account activity will appear here.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <IconButton
              label={
                themePreference === "system"
                  ? darkTheme
                    ? "Using system theme (dark). Switch to light"
                    : "Using system theme (light). Switch to dark"
                  : darkTheme
                    ? "Use light theme"
                    : "Use dark theme"
              }
              icon={darkTheme ? "sun" : "moon"}
              onClick={toggleShellTheme}
              pressed={darkTheme}
            />

            <div ref={businessMenuRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen(false);
                  setBusinessOpen((open) => !open);
                }}
                aria-expanded={businessOpen}
                className="flex h-10 max-w-52 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ShellIcon name="briefcase" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">{businessName}</span>
                <ShellIcon name="chevron" className="h-3.5 w-3.5 shrink-0 rotate-90" />
              </button>
              {businessOpen && (
                <div className="absolute right-0 top-12 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800">
                    <p className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                      Current workspace
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {businessName}
                    </p>
                  </div>
                  <Link
                    href="/businesses"
                    onClick={() => setBusinessOpen(false)}
                    className="mt-1 flex min-h-10 items-center justify-between rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Businesses
                    <ShellIcon name="chevron" className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>

            <div className="hidden lg:block">
              <ShellUserButton />
            </div>

            <div className="lg:hidden">
              <IconButton
                label="Open navigation menu"
                icon="menu"
                onClick={() => setMobileMenuOpen(true)}
              />
            </div>
          </div>
        </header>

        <div className="min-w-0 pb-20 lg:pb-0">{children}</div>
      </div>

      <nav
        aria-label="Mobile primary navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid h-[4.5rem] grid-cols-5 border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] lg:hidden dark:border-slate-800 dark:bg-slate-900"
      >
        {bottomNavigation.map((item) => {
          const active = isNavigationActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.65rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
                active
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {active && (
                <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              )}
              <ShellIcon name={item.icon} className="h-5 w-5" />
              <span className="max-w-full truncate">
                {item.label === "Energy Records" ? "Records" : item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="More navigation options"
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.65rem] font-semibold text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:text-slate-400"
        >
          <ShellIcon name="menu" className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900"
          >
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <Logo />
              <IconButton
                label="Close navigation menu"
                icon="close"
                onClick={() => setMobileMenuOpen(false)}
              />
            </div>

            <div className="border-b border-slate-100 p-4 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Current workspace
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                {businessName}
              </p>
            </div>

            <nav aria-label="Mobile menu navigation" className="flex-1 space-y-1 p-3">
              {[...primaryNavigation, ...workspaceNavigation, ...secondaryNavigation].map((item) => (
                <NavigationLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ))}
            </nav>

            <div className="flex items-center gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
              <ShellUserButton />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Account menu
              </span>
            </div>
          </aside>
        </div>
      )}

      {searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shell-search-title"
          className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 p-4 pt-[12vh]"
        >
          <button
            type="button"
            aria-label="Close search"
            className="absolute inset-0"
            onClick={() => setSearchOpen(false)}
          />
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h2 id="shell-search-title" className="sr-only">
              Search GridSense navigation
            </h2>
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
              <ShellIcon name="search" className="h-5 w-5 text-slate-400" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search pages..."
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => navigateFromSearch(item.href)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ShellIcon name={item.icon} className="h-5 w-5 text-slate-400" />
                    <span className="flex-1">{item.label}</span>
                    <ShellIcon name="chevron" className="h-4 w-4 text-slate-300" />
                  </button>
                ))
              ) : (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  No matching pages found.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
