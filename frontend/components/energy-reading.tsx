import type { EnergyProfile } from "@/lib/energy-profile";

type EnergyReadingProps = {
  profile: EnergyProfile;
};

export function EnergyReading({ profile }: EnergyReadingProps) {
  const highCostBurden = profile.flags.some((flag) => flag.id === "cost-burden");
  const emphasize =
    profile.ges.available && profile.ges.rating === "Critical"
      ? true
      : highCostBurden;

  return (
    <section
      aria-label="What's going on"
      className={`rounded-xl border p-5 sm:p-6 ${
        emphasize
          ? "border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30"
          : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.14em] ${
          emphasize
            ? "text-amber-800 dark:text-amber-300"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        What’s going on
      </p>
      <h3
        className={`mt-2 text-lg font-semibold tracking-tight sm:text-xl ${
          emphasize
            ? "text-amber-950 dark:text-amber-100"
            : "text-slate-950 dark:text-white"
        }`}
      >
        {profile.reading.headline}
      </h3>
      <p
        className={`mt-2 text-sm leading-6 ${
          emphasize
            ? "text-amber-900/90 dark:text-amber-200/90"
            : "text-slate-600 dark:text-slate-400"
        }`}
      >
        {profile.reading.body}
      </p>

      {profile.flags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {profile.flags.map((flag) => (
            <li
              key={flag.id}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                flag.id === profile.reading.primaryFlagId
                  ? emphasize
                    ? "border-amber-300 bg-white text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100"
                    : "border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  : emphasize
                    ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                    : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {flag.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
