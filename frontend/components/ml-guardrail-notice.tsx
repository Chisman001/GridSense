import {
  COVERAGE_LIMITED_BODY,
  COVERAGE_LIMITED_TITLE,
  WHATIF_FLAT_BODY,
  WHATIF_FLAT_TITLE,
} from "@/lib/ml-guardrails";

type MlGuardrailNoticeVariant = "coverage" | "flat-scenario";

type MlGuardrailNoticeProps = {
  variant: MlGuardrailNoticeVariant;
  className?: string;
};

const copyByVariant: Record<
  MlGuardrailNoticeVariant,
  { title: string; body: string }
> = {
  coverage: {
    title: COVERAGE_LIMITED_TITLE,
    body: COVERAGE_LIMITED_BODY,
  },
  "flat-scenario": {
    title: WHATIF_FLAT_TITLE,
    body: WHATIF_FLAT_BODY,
  },
};

export function MlGuardrailNotice({
  variant,
  className = "",
}: MlGuardrailNoticeProps) {
  const copy = copyByVariant[variant];

  return (
    <div
      className={`rounded-lg border border-amber-200 border-l-4 border-l-amber-400 bg-amber-50/80 px-3.5 py-3 dark:border-amber-800 dark:border-l-amber-400 dark:bg-amber-950/30 ${className}`.trim()}
    >
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {copy.title}
      </p>
      <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-200/90">
        {copy.body}
      </p>
    </div>
  );
}
