import { primaryButtonClasses } from "./button-styles";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <section className="rounded-xl border border-red-200 bg-white p-6 sm:p-8 dark:border-red-900/60 dark:bg-red-950/20">
      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-red-200">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`mt-5 ${primaryButtonClasses}`}>
          Try again
        </button>
      )}
    </section>
  );
}
