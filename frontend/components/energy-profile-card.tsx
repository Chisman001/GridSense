import type { EnergyProfile } from "@/lib/energy-profile";
import {
  formatForecastCurrency,
  formatForecastPercent,
} from "@/lib/forecast-scenario";
import {
  formatGesScoreValue,
  getGesRatingBadgeClasses,
} from "@/lib/ges-display";

type EnergyProfileCardProps = {
  profile: EnergyProfile;
};

function formatPeriod(year: number, month: number) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

export function EnergyProfileCard({ profile }: EnergyProfileCardProps) {
  const billTotal =
    profile.cost.electricity + profile.cost.diesel + profile.cost.petrol;
  const showMix = billTotal > 0;

  const kpis = [
    {
      label: "Monthly cost",
      value: formatForecastCurrency(profile.cost.total),
      context: formatPeriod(profile.period.year, profile.period.month),
    },
    {
      label: "Energy Score",
      value: profile.ges.available ? formatGesScoreValue(profile.ges) : "Unavailable",
      context: profile.ges.available
        ? "From recorded bills and hours"
        : "Not calculated",
      badge: profile.ges.available ? profile.ges.rating : null,
    },
    {
      label: "Generator",
      value: formatForecastPercent(profile.dependency.generator * 100),
      context: "Share of powered hours",
    },
    {
      label: "Grid",
      value: formatForecastPercent(profile.dependency.grid * 100),
      context: "Share of powered hours",
    },
    {
      label: "Outage hours",
      value: profile.outageHours.toFixed(1),
      context: "Recorded this month",
    },
    {
      label: "Energy / revenue",
      value: formatForecastPercent(profile.intensity.costShareOfRevenue * 100),
      context: "Cost share of monthly revenue",
    },
  ];

  return (
    <section aria-label="Energy profile" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {kpi.label}
              </p>
              {kpi.badge && profile.ges.available && (
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getGesRatingBadgeClasses(profile.ges.rating)}`}
                >
                  {kpi.badge}
                </span>
              )}
            </div>
            <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.7rem] dark:text-white">
              {kpi.value}
              {kpi.label === "Energy Score" && profile.ges.available && (
                <span className="text-base font-semibold text-slate-400 dark:text-slate-500">
                  /100
                </span>
              )}
            </p>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {kpi.context}
            </p>
          </article>
        ))}
      </div>

      {showMix && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Bill mix
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MixShare
              label="Electricity"
              amount={profile.cost.electricity}
              share={profile.cost.electricity / billTotal}
            />
            <MixShare
              label="Diesel"
              amount={profile.cost.diesel}
              share={profile.cost.diesel / billTotal}
            />
            <MixShare
              label="Petrol"
              amount={profile.cost.petrol}
              share={profile.cost.petrol / billTotal}
            />
          </dl>
        </div>
      )}
    </section>
  );
}

function MixShare({
  label,
  amount,
  share,
}: {
  label: string;
  amount: number;
  share: number;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
        {formatForecastPercent(share * 100)}
        <span className="ml-2 font-medium text-slate-500 dark:text-slate-400">
          {formatForecastCurrency(amount)}
        </span>
      </dd>
    </div>
  );
}
