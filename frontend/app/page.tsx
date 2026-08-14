import Link from "next/link";

import { FaqAccordion } from "@/components/landing/faq-accordion";
import { ShellIcon } from "@/components/shell/shell-icon";
import type { ShellIconName } from "@/components/shell/navigation";

const features: {
  number: string;
  icon: ShellIconName;
  title: string;
  description: string;
  indicator?: { label: string; value: string; tone?: "emerald" | "blue" | "slate" };
  className?: string;
}[] = [
  {
    number: "01",
    icon: "bolt",
    title: "Energy Cost Intelligence",
    description:
      "Track monthly energy spending and understand cost patterns across grid, fuel, and total spend.",
    indicator: { label: "Monthly cost", value: "₦2.48m", tone: "slate" },
    className: "sm:col-span-2 lg:col-span-7",
  },
  {
    number: "02",
    icon: "activity",
    title: "GridSense Energy Score",
    description:
      "Understand overall energy performance through a single standardized score calculated from your operating data.",
    indicator: { label: "GES score", value: "78.4 / 100", tone: "emerald" },
    className: "lg:col-span-5",
  },
  {
    number: "03",
    icon: "analytics",
    title: "AI-Powered Forecasting",
    description:
      "Forecast upcoming energy costs using GridSense's prediction model trained on your energy profile.",
    indicator: { label: "Next month", value: "₦2.31m", tone: "blue" },
    className: "lg:col-span-4",
  },
  {
    number: "04",
    icon: "reports",
    title: "Operational Insights",
    description:
      "Understand generator dependency, outage exposure, renewable contribution, and other operational indicators.",
    indicator: { label: "Generator use", value: "34%", tone: "slate" },
    className: "lg:col-span-4",
  },
  {
    number: "05",
    icon: "insights",
    title: "AI Recommendations",
    description:
      "Turn forecasts and operational signals into practical actions you can review and act on.",
    indicator: { label: "Priority", value: "Optimize backup power", tone: "emerald" },
    className: "lg:col-span-4",
  },
];

const steps = [
  {
    number: "01",
    icon: "reports" as const,
    title: "Add your energy data",
    description:
      "Upload CSV records or enter monthly operating data for your business.",
  },
  {
    number: "02",
    icon: "analytics" as const,
    title: "Generate your forecast",
    description:
      "GridSense analyzes your profile and produces a next-month cost outlook with performance signals.",
  },
  {
    number: "03",
    icon: "insights" as const,
    title: "Act on the insights",
    description:
      "Review forecasts, operational indicators, and AI recommendations to inform your decisions.",
  },
];

const useCases = [
  {
    label: "Cost control",
    question: "Where is our energy spend going?",
    answer:
      "GridSense consolidates monthly costs, consumption, and source breakdown so you can see where spend is concentrated and how it changes over time.",
  },
  {
    label: "Forecasting",
    question: "What should we expect next month?",
    answer:
      "Run a forecast from your energy profile to see predicted next-month cost, expected change, and supporting operational context.",
  },
  {
    label: "Operations",
    question: "Where are avoidable energy costs coming from?",
    answer:
      "Review generator dependency, outage exposure, renewable contribution, and AI recommendations to identify practical improvement areas.",
  },
];

const faqGroups = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is GridSense?",
        answer:
          "GridSense is an energy intelligence platform that helps businesses organize energy records, forecast upcoming energy costs, understand operational indicators, and receive AI-powered recommendations.",
      },
      {
        question: "Who is GridSense for?",
        answer:
          "GridSense is designed for businesses that want clearer visibility into energy expenditure and the operational factors that influence it.",
      },
      {
        question: "What data do I need to use GridSense?",
        answer:
          "You can enter monthly cost, consumption, energy-source, operating, outage, generator, renewable-energy, and business-context data. Provide the detail relevant to your operation.",
      },
      {
        question: "Do I need technical knowledge to use GridSense?",
        answer:
          "No. GridSense is designed around guided data entry, readable forecasts, and clear recommendations for business users.",
      },
    ],
  },
  {
    title: "Forecasting",
    items: [
      {
        question: "How does the energy forecast work?",
        answer:
          "GridSense sends your energy and operating profile to its forecasting service, which estimates the next month's energy cost and related indicators. Forecasts are estimates and should support, not replace, business judgment.",
      },
      {
        question: "What does GridSense predict?",
        answer:
          "GridSense predicts next-month total energy cost based on your submitted profile. Forecast results also include expected change versus recent periods where sufficient data is available.",
      },
      {
        question: "How accurate is the forecast?",
        answer:
          "Forecast accuracy depends on the quality and consistency of your input data. GridSense provides estimates to support planning — not guaranteed outcomes or savings.",
      },
    ],
  },
  {
    title: "Data",
    items: [
      {
        question: "Can I upload CSV energy records?",
        answer:
          "Yes. The Energy Records workspace supports CSV imports, and records can also be entered manually.",
      },
      {
        question: "What happens to my energy data?",
        answer:
          "Your energy records are stored in your GridSense account and used to generate forecasts, analytics, and insights for your business. Data is accessible only through your authenticated account.",
      },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        question: "What is the GridSense Energy Score?",
        answer:
          "The GridSense Energy Score (GES) is a platform-computed 0–100 score based on cost burden, generator dependency, and operational factors from your entered data. It provides a standardized view of energy performance.",
      },
      {
        question: "What kind of recommendations does GridSense provide?",
        answer:
          "GridSense uses the saved forecast and energy profile to surface practical AI-generated observations and recommended actions related to costs, efficiency, and operational risk.",
      },
    ],
  },
];

const productLinks = [
  ["Dashboard", "/dashboard"],
  ["Energy Records", "/energy-records"],
  ["Analytics", "/analytics"],
  ["AI Insights", "/ai-insights"],
  ["Forecast", "/forecast"],
  ["Reports", "/reports"],
];

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="GridSense home"
      className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          inverse
            ? "bg-emerald-400 text-slate-950"
            : "bg-slate-950 text-emerald-400"
        }`}
      >
        <ShellIcon name="bolt" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span
          className={`block truncate text-base font-bold tracking-tight ${
            inverse ? "text-white" : "text-slate-950"
          }`}
        >
          GridSense
        </span>
        <span
          className={`hidden text-xs sm:block ${
            inverse ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Energy intelligence
        </span>
      </span>
    </Link>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const secondaryButtonDark =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-white/20 bg-transparent px-5 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

function PipelineStep({ label }: { label: string }) {
  return (
    <span className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-300">
      {label}
    </span>
  );
}

function HeroProductPreview() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/80 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-950 text-emerald-400">
              <ShellIcon name="bolt" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-white">GridSense</p>
              <p className="text-[0.62rem] text-slate-400">
                Illustrative product preview
              </p>
            </div>
          </div>
          <span className="hidden rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-slate-400 sm:inline">
            Sample data
          </span>
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-3">
              <p className="text-[0.58rem] font-medium uppercase tracking-wider text-slate-500">
                Energy cost
              </p>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-white sm:text-xl">
                ₦2.48m
              </p>
              <p className="mt-0.5 text-[0.58rem] text-slate-500">July</p>
            </div>
            <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3">
              <p className="text-[0.58rem] font-medium uppercase tracking-wider text-emerald-600/80">
                GES score
              </p>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-white sm:text-xl">
                78.4
                <span className="text-xs font-medium text-slate-500">/100</span>
              </p>
              <p className="mt-0.5 text-[0.58rem] font-medium text-emerald-400">
                Good
              </p>
            </div>
            <div className="rounded-lg border border-blue-900/50 bg-blue-950/30 p-3">
              <p className="text-[0.58rem] font-medium uppercase tracking-wider text-blue-400/80">
                Next-month forecast
              </p>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-white sm:text-xl">
                ₦2.31m
              </p>
              <p className="mt-0.5 text-[0.58rem] font-medium text-emerald-400">
                −6.8%
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-slate-400">
                  Cost trend
                </p>
                <ShellIcon name="analytics" className="h-4 w-4 text-blue-400" />
              </div>
              <div
                className="mt-3 flex h-16 items-end gap-1"
                aria-hidden="true"
              >
                {[32, 44, 38, 52, 48, 58, 54, 62, 56, 50].map((height, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${
                      i >= 8 ? "bg-emerald-400/90" : "bg-blue-500/70"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[0.55rem] text-slate-500">
                <span>Historical</span>
                <span>Forecast</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-slate-400">
                Generator dependency
              </p>
              <p className="mt-2 text-2xl font-bold text-white">34%</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-[34%] rounded-full bg-amber-400/90" />
              </div>
              <p className="mt-2 text-[0.58rem] leading-4 text-slate-500">
                Operational signal from grid vs. generator hours
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-400/15 text-emerald-400">
                <ShellIcon name="insights" className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.62rem] font-semibold uppercase tracking-wider text-emerald-400">
                  AI recommendation
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Review generator scheduling during peak grid availability to
                  reduce avoidable fuel costs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureIndicator({
  indicator,
}: {
  indicator: NonNullable<(typeof features)[number]["indicator"]>;
}) {
  const toneClasses = {
    emerald: "border-emerald-200/80 bg-emerald-50 text-emerald-800",
    blue: "border-blue-200/80 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div
      className={`mt-4 inline-flex items-center gap-2 rounded border px-2.5 py-1.5 ${toneClasses[indicator.tone ?? "slate"]}`}
    >
      <span className="text-[0.6rem] font-medium uppercase tracking-wider opacity-70">
        {indicator.label}
      </span>
      <span className="font-mono text-xs font-semibold">{indicator.value}</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8"
        >
          <Brand inverse />

          <div className="ml-auto hidden items-center gap-1 md:flex">
            {[
              ["Features", "#features"],
              ["How it works", "#how-it-works"],
              ["FAQ", "#faq"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Link
              href="/login"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Log in
            </Link>
            <Link
              href="/start-analysis"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Start Free Analysis
            </Link>
          </div>

          <Link
            href="/start-analysis"
            className="ml-auto inline-flex min-h-9 items-center justify-center rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 md:hidden"
          >
            Start Free Analysis
          </Link>

          <details className="group relative md:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Open navigation menu</span>
              <ShellIcon name="menu" className="h-5 w-5 group-open:hidden" />
              <ShellIcon name="close" className="hidden h-5 w-5 group-open:block" />
            </summary>
            <div className="absolute right-0 top-11 w-64 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-2xl">
              {[
                ["Features", "#features"],
                ["How it works", "#how-it-works"],
                ["FAQ", "#faq"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  {label}
                </a>
              ))}
              <Link
                href="/login"
                className="mt-1 block border-t border-slate-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Log in
              </Link>
            </div>
          </details>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section id="about" className="relative bg-slate-950 text-white">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black_60%,transparent)]"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
              <div className="max-w-xl">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-emerald-400">
                  Energy intelligence for modern businesses
                </p>
                <h1 className="mt-5 text-4xl font-bold leading-[1.06] tracking-[-0.03em] sm:text-5xl lg:text-[3.25rem]">
                  Turn energy data into{" "}
                  <span className="text-emerald-400">smarter</span> business
                  decisions.
                </h1>
                <p className="mt-5 text-base leading-7 text-slate-400 sm:text-[1.05rem]">
                  GridSense helps businesses monitor energy costs, forecast what
                  is coming next, and turn operational data into actionable
                  insights.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link href="/start-analysis" className={primaryButton}>
                    Start Free Analysis
                    <ArrowIcon />
                  </Link>
                  <a href="#how-it-works" className={secondaryButtonDark}>
                    See How It Works
                  </a>
                </div>

                <div
                  className="mt-8 flex flex-wrap items-center gap-2"
                  aria-label="Product workflow"
                >
                  <PipelineStep label="Data" />
                  <span aria-hidden="true" className="text-slate-600">
                    →
                  </span>
                  <PipelineStep label="Analysis" />
                  <span aria-hidden="true" className="text-slate-600">
                    →
                  </span>
                  <PipelineStep label="Forecast" />
                  <span aria-hidden="true" className="text-slate-600">
                    →
                  </span>
                  <PipelineStep label="Action" />
                </div>
              </div>

              <div className="lg:pl-2">
                <HeroProductPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-14 sm:py-18">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Platform capabilities
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                One connected view of your energy.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                From monthly costs to operational performance and next-month
                forecasts, GridSense brings the signals together.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
              {features.map((feature) => (
                <article
                  key={feature.number}
                  className={`group rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 ${feature.className ?? ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 transition-colors group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-700">
                        <ShellIcon name={feature.icon} className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-xs font-medium text-slate-400">
                        {feature.number}
                      </span>
                    </div>
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-950">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {feature.description}
                  </p>
                  {feature.indicator && (
                    <FeatureIndicator indicator={feature.indicator} />
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-14 sm:py-18"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-blue-600">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                From energy records to better decisions.
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                A connected workflow turns your operating data into forecasts,
                performance signals, and actionable insights.
              </p>
            </div>

            <div className="relative mt-10">
              <div
                aria-hidden="true"
                className="absolute left-0 right-0 top-[2.25rem] hidden h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent lg:block"
              />
              <ol className="grid gap-4 lg:grid-cols-3 lg:gap-6">
                {steps.map((step, index) => (
                  <li
                    key={step.number}
                    className="relative rounded-lg border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-950 text-emerald-400">
                        <ShellIcon name={step.icon} className="h-4 w-4" />
                      </span>
                      <span className="font-mono text-sm font-medium text-slate-300">
                        {step.number}
                      </span>
                      {index < steps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="ml-auto hidden text-slate-300 lg:inline"
                        >
                          →
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.08em] text-slate-950">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {step.description}
                    </p>
                  </li>
                ))}
              </ol>

              <p className="mt-6 text-center text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Energy data → GridSense analysis → Forecast + insights → Action
              </p>
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="py-14 sm:py-18">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Decision framework
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Built around the decisions businesses actually make.
              </h2>
            </div>

            <div className="mt-10 grid gap-3 lg:grid-cols-3">
              {useCases.map((useCase) => (
                <article
                  key={useCase.label}
                  className="rounded-lg border border-slate-200 bg-white p-5"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    {useCase.label}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                    {useCase.question}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {useCase.answer}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-20 border-t border-slate-200 bg-slate-50 py-14 sm:py-18"
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-blue-600">
                FAQ
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Questions businesses ask before getting started.
              </h2>
            </div>

            <div className="mt-8">
              <FaqAccordion groups={faqGroups} />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-6 py-10 text-center sm:px-10 sm:py-12">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Start making better energy decisions.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400">
                Bring your energy records into GridSense and turn operational
                data into forecasts, performance signals, and actionable
                insights.
              </p>
              <Link
                href="/start-analysis"
                className={`${primaryButton} mt-7 w-full sm:w-auto`}
              >
                Start Free Analysis
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:px-8 lg:py-12">
          <div>
            <Brand inverse />
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
              Forecast costs, understand performance, and turn energy data into
              practical business decisions.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Product
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {productLinks.map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-slate-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Company
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {[
                ["About", "#about"],
                ["How it works", "#how-it-works"],
                ["FAQ", "#faq"],
              ].map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-slate-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Account
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/login"
                  className="text-slate-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href="/start-analysis"
                  className="text-slate-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Start Free Analysis
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Legal
            </h2>
            <ul
              aria-label="Legal pages coming soon"
              className="mt-3 space-y-2.5 text-sm text-slate-500"
            >
              <li>
                <span title="Page coming soon">Privacy Policy</span>
              </li>
              <li>
                <span title="Page coming soon">Terms of Service</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} GridSense.</p>
            <p>Energy intelligence for better business decisions.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
