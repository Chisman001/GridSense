type EnergyOverviewPeriod = {
  year: number;
  month: number;
};

type EnergyOverviewPeriodNavProps = {
  records: EnergyOverviewPeriod[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
};

function formatPeriod(year: number, month: number) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

export function EnergyOverviewPeriodNav({
  records,
  selectedIndex,
  onSelectIndex,
}: EnergyOverviewPeriodNavProps) {
  const selected = records[selectedIndex];
  if (!selected) {
    return null;
  }

  const canGoPrevious = selectedIndex > 0;
  const canGoNext = selectedIndex < records.length - 1;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Recorded month
        </p>
        <p
          aria-live="polite"
          className="mt-1 truncate text-base font-semibold text-slate-950 dark:text-white"
        >
          {formatPeriod(selected.year, selected.month)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Previous recorded month"
          disabled={!canGoPrevious}
          onClick={() => onSelectIndex(selectedIndex - 1)}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
        >
          Previous
        </button>
        <button
          type="button"
          aria-label="Next recorded month"
          disabled={!canGoNext}
          onClick={() => onSelectIndex(selectedIndex + 1)}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
        >
          Next
        </button>
      </div>
    </div>
  );
}
