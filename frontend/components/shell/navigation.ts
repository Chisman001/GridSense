export type ShellIconName =
  | "activity"
  | "analytics"
  | "bell"
  | "bolt"
  | "briefcase"
  | "building"
  | "chevron"
  | "close"
  | "dashboard"
  | "insights"
  | "menu"
  | "moon"
  | "profile"
  | "reports"
  | "search"
  | "settings"
  | "sun";

export type NavigationItem = {
  label: string;
  href: string;
  icon: ShellIconName;
};

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Energy Records", href: "/energy-records", icon: "bolt" },
  { label: "Analytics", href: "/analytics", icon: "analytics" },
  { label: "AI Insights", href: "/ai-insights", icon: "insights" },
  { label: "Forecast", href: "/forecast", icon: "activity" },
  { label: "Reports", href: "/reports", icon: "reports" },
];

export const workspaceNavigation: NavigationItem[] = [
  { label: "Businesses", href: "/businesses", icon: "building" },
];

export const secondaryNavigation: NavigationItem[] = [
  { label: "Settings", href: "/settings", icon: "settings" },
  { label: "Profile", href: "/profile", icon: "profile" },
];

export const bottomNavigation: NavigationItem[] = [
  primaryNavigation[0],
  primaryNavigation[1],
  primaryNavigation[2],
  primaryNavigation[3],
];

export const shellRoutes = [
  ...primaryNavigation,
  ...workspaceNavigation,
  ...secondaryNavigation,
];

export function getPageTitle(pathname: string): string {
  const route = shellRoutes.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
  );

  return route?.label ?? "GridSense";
}

export function isNavigationActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
