import { type ForecastDriver } from "@/lib/forecast-scenario";

type ForecastDriversProps = {
  drivers: ForecastDriver[];
};

export function ForecastDrivers({ drivers }: ForecastDriversProps) {
  if (drivers.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
        Why this matters
      </h3>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        Observed conditions from this month’s inputs, not model feature
        importance.
      </p>
      <ul className="mt-4 space-y-3">
        {drivers.map((driver) => (
          <li key={driver.id} className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            <span className="font-medium text-slate-950 dark:text-white">
              {driver.label}.
            </span>{" "}
            {driver.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}
