import type { ReactNode } from "react";

import { primaryButtonClasses } from "./button-styles";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
      {icon && (
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
          {icon}
        </span>
      )}
      <h3 className={`${icon ? "mt-5" : ""} text-xl font-semibold text-slate-950 dark:text-white`}>
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action &&
        (action.href ? (
          <a href={action.href} className={`mt-6 ${primaryButtonClasses}`}>
            {action.label}
          </a>
        ) : (
          <button type="button" onClick={action.onClick} className={`mt-6 ${primaryButtonClasses}`}>
            {action.label}
          </button>
        ))}
    </section>
  );
}
