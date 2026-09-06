"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";

import {
  BUSINESS_STATES,
  BUSINESS_TYPES,
  INDUSTRIES,
  optionsIncluding,
} from "@/lib/business-profile";

type Business = {
  id: string;
  businessName: string;
  businessType: string;
  industry: string;
  state: string;
  createdAt: string;
  updatedAt: string;
};

type BusinessForm = {
  businessName: string;
  businessType: string;
  industry: string;
  state: string;
};

type ContextLink = {
  href: string;
  label: string;
  description: string;
  icon: "dashboard" | "bolt" | "analytics" | "insights" | "reports";
};

const CONTEXT_LINKS: ContextLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Overview of costs, forecasts, and recommendations",
    icon: "dashboard",
  },
  {
    href: "/energy-records",
    label: "Energy records",
    description: "Monthly operating data tied to this business",
    icon: "bolt",
  },
  {
    href: "/analytics",
    label: "Analytics",
    description: "Trends and breakdowns from your energy history",
    icon: "analytics",
  },
  {
    href: "/ai-insights",
    label: "AI insights",
    description: "Recommendations generated for your forecasts",
    icon: "insights",
  },
  {
    href: "/reports",
    label: "Reports",
    description: "Saved forecast reports labeled with this profile",
    icon: "reports",
  },
];

const BUSINESS_UPDATED_EVENT = "gridsense:business-updated";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBusiness(value: unknown): value is Business {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.businessName === "string" &&
    typeof value.businessType === "string" &&
    typeof value.industry === "string" &&
    typeof value.state === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function parseBusinessResponse(value: unknown): Business | null {
  if (!isRecord(value) || !("business" in value)) {
    throw new Error("Business API returned an invalid response.");
  }

  if (value.business === null) {
    return null;
  }

  if (!isBusiness(value.business)) {
    throw new Error("Business API returned an invalid business profile.");
  }

  return value.business;
}

function getErrorMessage(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return fallback;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function truncateId(id: string) {
  if (id.length <= 16) {
    return id;
  }

  return `${id.slice(0, 8)}...${id.slice(-8)}`;
}

function notifyBusinessUpdated(businessName: string) {
  window.dispatchEvent(
    new CustomEvent(BUSINESS_UPDATED_EVENT, {
      detail: { businessName },
    })
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      }`}
    >
      {children}
    </div>
  );
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "analytics"
    | "bolt"
    | "building"
    | "close"
    | "copy"
    | "dashboard"
    | "edit"
    | "insights"
    | "reports";
  className?: string;
}) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "building":
      return (
        <svg {...common}>
          <path d="M4 21V5a2 2 0 0 1 2-2h7l5 5v13" />
          <path d="M14 3v4h4" />
          <path d="M8 9h2M8 13h2M8 17h2M14 13h2M14 17h2" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 16v-5M12 16V8M16 16v-3" />
        </svg>
      );
    case "insights":
      return (
        <svg {...common}>
          <path d="M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3Z" />
          <path d="M10 21h4" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common}>
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
      );
  }
}

function LoadingState() {
  return (
    <section aria-label="Loading business profile" className="space-y-6">
      <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-5 h-8 w-64 max-w-full rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 h-4 w-40 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-6 h-10 w-32 rounded bg-slate-100 dark:bg-slate-800" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-6 space-y-4">
            <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
        <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-6 space-y-4">
            <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="mt-4 h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </section>
  );
}

function formFromBusiness(business: Business): BusinessForm {
  return {
    businessName: business.businessName,
    businessType: business.businessType,
    industry: business.industry,
    state: business.state,
  };
}

export default function BusinessesPage() {
  const dialogTitleId = useId();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<BusinessForm>({
    businessName: "",
    businessType: "",
    industry: "",
    state: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadBusiness = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/business", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal,
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to load your business profile.")
        );
      }

      const nextBusiness = parseBusinessResponse(payload);
      setBusiness(nextBusiness);

      if (nextBusiness) {
        notifyBusinessUpdated(nextBusiness.businessName);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setBusiness(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load your business profile."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadBusiness(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadBusiness]);

  useEffect(() => {
    if (!editOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setEditOpen(false);
        setSaveError("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editOpen, saving]);

  function openEdit() {
    if (!business) {
      return;
    }

    setForm(formFromBusiness(business));
    setSaveError("");
    setEditOpen(true);
  }

  function closeEdit() {
    if (saving) {
      return;
    }

    setEditOpen(false);
    setSaveError("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setSaveError("");

    const payload = {
      businessName: form.businessName.trim(),
      businessType: form.businessType.trim(),
      industry: form.industry.trim(),
      state: form.state.trim(),
    };

    if (
      !payload.businessName ||
      !payload.businessType ||
      !payload.industry ||
      !payload.state
    ) {
      setSaveError("All fields are required.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/business", {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responsePayload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(responsePayload, "Failed to update business profile.")
        );
      }

      const updated = parseBusinessResponse(responsePayload);

      if (!updated) {
        throw new Error("Business profile was not returned after update.");
      }

      setBusiness(updated);
      notifyBusinessUpdated(updated.businessName);
      setEditOpen(false);
      setNotice("Business profile updated.");
      window.setTimeout(() => setNotice(""), 4000);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to update business profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyBusinessId() {
    if (!business) {
      return;
    }

    try {
      await navigator.clipboard.writeText(business.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Could not copy business ID.");
      window.setTimeout(() => setNotice(""), 4000);
    }
  }

  return (
    <main className="overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-transparent dark:text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                Business
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
              Business profile
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Manage the business profile used across your forecasts, energy
              records, analytics, AI insights, and reports.
            </p>
          </div>
        </section>

        {notice && (
          <div className="mt-6">
            <Notice tone="success">{notice}</Notice>
          </div>
        )}

        <div className="mt-6">
          {loading && <LoadingState />}

          {!loading && loadError && (
            <section className="rounded-xl border border-red-200 bg-white p-6 sm:p-8 dark:border-red-900/60 dark:bg-slate-900">
              <div className="flex max-w-xl flex-col items-start">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  <Icon name="building" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">
                  Unable to load your business profile.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadBusiness()}
                  className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
                >
                  Try again
                </button>
              </div>
            </section>
          )}

          {!loading && !loadError && !business && (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:py-16 dark:border-slate-700 dark:bg-slate-900">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Icon name="building" className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">
                Set up your business profile
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
                Add your business details to start using forecasts, analytics,
                and reports.
              </p>
              <Link
                href="/onboarding"
                className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
              >
                Set up business
              </Link>
            </section>
          )}

          {!loading && !loadError && business && (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-5 py-6 sm:px-7 sm:py-8 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                          <Icon name="building" className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            Active profile
                          </p>
                          <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
                            {business.businessName}
                          </h2>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            {business.businessType}
                            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                            {business.industry}
                            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                            {business.state}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={openEdit}
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:w-auto dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                      Edit profile
                    </button>
                  </div>
                </div>

                <div className="grid gap-px bg-slate-100 sm:grid-cols-3 dark:bg-slate-800">
                  <div className="bg-white px-5 py-4 sm:px-6 dark:bg-slate-900">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Business type
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {business.businessType}
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4 sm:px-6 dark:bg-slate-900">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Industry
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {business.industry}
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4 sm:px-6 dark:bg-slate-900">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      State
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {business.state}
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    Profile details
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Stored metadata for this workspace business.
                  </p>

                  <dl className="mt-5 space-y-4">
                    <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                      <dt className="text-sm text-slate-500 dark:text-slate-400">Business type</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
                        {business.businessType}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                      <dt className="text-sm text-slate-500 dark:text-slate-400">Industry</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
                        {business.industry}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                      <dt className="text-sm text-slate-500 dark:text-slate-400">State</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
                        {business.state}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                      <dt className="text-sm text-slate-500 dark:text-slate-400">Created</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatDate(business.createdAt)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="text-sm text-slate-500 dark:text-slate-400">Last updated</dt>
                      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatDate(business.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    Account information
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Technical identifier for this business profile.
                  </p>

                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/70">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Business ID
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 sm:text-sm dark:text-slate-400">
                        {truncateId(business.id)}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyBusinessId()}
                        aria-label="Copy business ID"
                        title={copied ? "Copied" : "Copy business ID"}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Icon name="copy" className="h-4 w-4" />
                      </button>
                    </div>
                    {copied && (
                      <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300" role="status">
                        Copied to clipboard
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="max-w-3xl">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    Your business profile connects the workspace.
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Energy records, forecasts, analytics, AI insights, and
                    reports are associated with this business. Use these links
                    to continue working in the rest of GridSense.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {CONTEXT_LINKS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-emerald-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-800 dark:bg-slate-800/70 dark:hover:border-emerald-800 dark:hover:bg-slate-900"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200 group-hover:ring-emerald-200 dark:bg-slate-900 dark:text-emerald-300 dark:ring-slate-700 dark:group-hover:ring-emerald-800">
                        <Icon name={item.icon} className="h-4 w-4" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {editOpen && business && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
        >
          <button
            type="button"
            aria-label="Close edit dialog"
            className="absolute inset-0"
            onClick={closeEdit}
            disabled={saving}
          />
          <div className="relative flex max-h-[95vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-800">
              <div>
                <h2
                  id={dialogTitleId}
                  className="text-lg font-semibold text-slate-950 sm:text-xl dark:text-white"
                >
                  Edit business profile
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Update the details shown across your GridSense workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                aria-label="Close dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveProfile} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 dark:bg-slate-800/70">
                <fieldset disabled={saving} className="space-y-4">
                  <legend className="sr-only">Business profile fields</legend>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Business name
                    </span>
                    <input
                      name="businessName"
                      type="text"
                      required
                      value={form.businessName}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          businessName: event.target.value,
                        }))
                      }
                      placeholder="e.g. Aba Packaging & Plastics Ltd."
                      className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:ring-emerald-900/30"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Business type
                    </span>
                    <select
                      name="businessType"
                      required
                      value={form.businessType}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          businessType: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-900/30"
                    >
                      {optionsIncluding(BUSINESS_TYPES, form.businessType).map(
                        (option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Industry
                    </span>
                    <select
                      name="industry"
                      required
                      value={form.industry}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          industry: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-900/30"
                    >
                      {optionsIncluding(INDUSTRIES, form.industry).map(
                        (option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      State
                    </span>
                    <select
                      name="state"
                      required
                      value={form.state}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          state: event.target.value,
                        }))
                      }
                      className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-900/30"
                    >
                      {optionsIncluding(BUSINESS_STATES, form.state).map(
                        (option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </fieldset>

                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Changes to your business profile may appear on future and
                  previously generated report views.
                </p>

                {saveError && <Notice tone="error">{saveError}</Notice>}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:justify-end sm:px-6 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  aria-busy={saving}
                  className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait disabled:opacity-60 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
