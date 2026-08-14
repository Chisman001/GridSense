import Link from "next/link";

import type { ShellIconName } from "./navigation";
import { ShellIcon } from "./shell-icon";

export function RoutePlaceholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ShellIconName;
}) {
  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="flex min-h-[22rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.02)] dark:border-slate-700 dark:bg-slate-900">
          <div className="max-w-md">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              <ShellIcon name={icon} className="h-6 w-6" />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Workspace ready
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl dark:text-white">
              {title} is not available yet
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {description}
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
            >
              Return to dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
