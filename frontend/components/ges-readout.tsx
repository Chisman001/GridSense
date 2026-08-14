import {
  formatGesScoreValue,
  getGesCardClasses,
  getGesRatingBadgeClasses,
} from "@/lib/ges-display";
import {
  type GesV1Result,
  gesUnavailableMessage,
} from "@/lib/ges-v1";

type GesReadoutProps = {
  result: GesV1Result;
  compact?: boolean;
  showHelper?: boolean;
};

export function GesReadout({
  result,
  compact = false,
  showHelper = true,
}: GesReadoutProps) {
  if (!result.available) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          GridSense Energy Score
        </p>
        <p className="mt-1 text-2xl font-bold text-amber-950 dark:text-amber-100">
          Unavailable
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300/90">
          {gesUnavailableMessage(result.reason)}
        </p>
      </div>
    );
  }

  const cardClasses = getGesCardClasses(result.rating);
  const badgeClasses = getGesRatingBadgeClasses(result.rating);

  if (compact) {
    return (
      <div className={`rounded-xl border p-4 ${cardClasses}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
              GridSense Energy Score
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {formatGesScoreValue(result)}
              <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                /100
              </span>
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses}`}
          >
            {result.rating}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${cardClasses}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          GridSense Energy Score
        </p>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses}`}
        >
          {result.rating}
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
        {formatGesScoreValue(result)}
        <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">
          /100
        </span>
      </p>
      {showHelper && (
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
          Calculated from your energy performance data. Read-only.
        </p>
      )}
    </div>
  );
}

export function GesRatingBadge({ rating }: { rating: string }) {
  const classes = getGesRatingBadgeClasses(
    rating as "Excellent" | "Good" | "Needs Improvement" | "Critical"
  );

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {rating}
    </span>
  );
}
