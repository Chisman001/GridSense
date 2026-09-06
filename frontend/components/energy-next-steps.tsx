import Link from "next/link";

import { secondaryButtonClasses } from "@/components/ui/button-styles";

type EnergyNextStepsProps = {
  generatorHours: number;
};

type NextStep = {
  href: string;
  step: string;
  title: string;
  description: string;
};

export function EnergyNextSteps({ generatorHours }: EnergyNextStepsProps) {
  const steps: NextStep[] = [
    {
      href: "/energy-records",
      step: "1",
      title: "Review records",
      description: "Check the bills and hours behind this month’s profile.",
    },
    {
      href: "/forecast",
      step: "2",
      title: "Next-month estimate",
      description: "Generate or review an estimated next-month energy cost.",
    },
  ];

  if (generatorHours > 0) {
    steps.push({
      href: "/forecast#what-if",
      step: "3",
      title: "Explore generator-use scenario",
      description:
        "Open What-If on Forecast to try a lower generator-use estimate.",
    });
  }

  return (
    <section aria-label="Next steps">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
        Next steps
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
        Continue the story
      </h3>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => (
          <li key={step.title} className="min-w-0">
            <Link
              href={step.href}
              className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                Step {step.step}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                {step.title}
              </p>
              <p className="mt-1 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {step.description}
              </p>
              <span className={`mt-4 w-fit ${secondaryButtonClasses}`}>
                Open
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
