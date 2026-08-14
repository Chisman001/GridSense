import type { GesRating, GesV1Result } from "@/lib/ges-v1";

export function getGesRatingBadgeClasses(rating: GesRating): string {
  switch (rating) {
    case "Excellent":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "Good":
      return "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300";
    case "Needs Improvement":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "Critical":
      return "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
  }
}

export function getGesCardClasses(rating: GesRating): string {
  switch (rating) {
    case "Excellent":
      return "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30";
    case "Good":
      return "border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30";
    case "Needs Improvement":
      return "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30";
    case "Critical":
      return "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30";
  }
}

export function formatGesScoreValue(result: GesV1Result): string {
  if (!result.available) {
    return "Unavailable";
  }

  return result.score.toFixed(1);
}

export function formatGesScoreWithRating(result: GesV1Result): string {
  if (!result.available) {
    return "Unavailable";
  }

  return `${result.score.toFixed(1)}/100 · ${result.rating}`;
}

export const GES_RATING_BANDS = [
  { range: "90–100", label: "Excellent" },
  { range: "75–89", label: "Good" },
  { range: "50–74", label: "Needs Improvement" },
  { range: "0–49", label: "Critical" },
] as const;
