"use client";

import { UserAvatar, UserProfile, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

type Business = {
  id: string;
  businessName: string;
  businessType: string;
  industry: string;
  state: string;
  createdAt: string;
};

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
    typeof value.createdAt === "string"
  );
}

function parseBusinessResponse(value: unknown): Business | null {
  if (!isRecord(value) || !("business" in value)) {
    return null;
  }

  if (value.business === null) {
    return null;
  }

  return isBusiness(value.business) ? value.business : null;
}

function getErrorMessage(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return fallback;
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

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
  if (id.length <= 18) {
    return id;
  }

  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

function PageHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description: string;
  eyebrow: string;
}) {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            {eyebrow}
          </p>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div aria-label="Loading profile" className="space-y-6">
      <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
      <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
        {children}
      </dd>
    </div>
  );
}

export default function ProfilePage() {
  const { isLoaded, user } = useUser();
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessError, setBusinessError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadBusiness = useCallback(async (signal?: AbortSignal) => {
    setBusinessLoading(true);
    setBusinessError("");

    try {
      const response = await fetch("/api/business", {
        headers: { Accept: "application/json" },
        signal,
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Failed to load your business workspace.")
        );
      }

      if (
        !isRecord(payload) ||
        !("business" in payload) ||
        (payload.business !== null && !isBusiness(payload.business))
      ) {
        throw new Error("Business API returned an invalid response.");
      }

      setBusiness(parseBusinessResponse(payload));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setBusiness(null);
      setBusinessError(
        error instanceof Error
          ? error.message
          : "Failed to load your business workspace."
      );
    } finally {
      if (!signal?.aborted) {
        setBusinessLoading(false);
      }
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

  async function copyUserId() {
    if (!user?.id) {
      return;
    }

    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const displayName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    "GridSense user";
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ?? "No email on file";
  const memberSince = user?.createdAt ? formatDate(user.createdAt) : "Unavailable";

  return (
    <main className="overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-transparent dark:text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PageHeader
          eyebrow="Profile"
          title="Your profile"
          description="View your GridSense identity, manage your Clerk account, and review the business workspace tied to your forecasts."
        />

        <div className="mt-6">
          {!isLoaded ? (
            <LoadingState />
          ) : (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-5 py-6 sm:px-7 sm:py-8 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <UserAvatar
                        appearance={{
                          elements: {
                            avatarBox: "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]",
                          },
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          Signed-in account
                        </p>
                        <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
                          {displayName}
                        </h2>
                        <p className="mt-2 truncate text-sm text-slate-600 dark:text-slate-400">
                          {primaryEmail}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                          Member since {memberSince}
                        </p>
                      </div>
                    </div>
                    <a
                      href="#manage-account"
                      className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
                    >
                      Manage account
                    </a>
                  </div>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                        Workspace
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                        Business workspace
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        The business profile used across forecasts, analytics,
                        insights, and reports.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    {businessLoading && (
                      <div
                        aria-label="Loading business workspace"
                        className="space-y-3"
                      >
                        <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                          <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                        </div>
                      </div>
                    )}

                    {!businessLoading && businessError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 dark:border-red-900/60 dark:bg-red-950/40">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                          Unable to load your business workspace.
                        </p>
                        <p className="mt-1 text-sm leading-6 text-red-700 dark:text-red-300">
                          {businessError}
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadBusiness()}
                          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {!businessLoading && !businessError && !business && (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          No business profile yet
                        </p>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
                          Set up your business profile to unlock forecasts,
                          analytics, and reports for this account.
                        </p>
                        <Link
                          href="/onboarding"
                          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-slate-900"
                        >
                          Set up business
                        </Link>
                      </div>
                    )}

                    {!businessLoading && !businessError && business && (
                      <>
                        <dl className="grid gap-3 sm:grid-cols-2">
                          <DetailItem label="Business name">
                            {business.businessName}
                          </DetailItem>
                          <DetailItem label="Business type">
                            {business.businessType}
                          </DetailItem>
                          <DetailItem label="Industry">
                            {business.industry}
                          </DetailItem>
                          <DetailItem label="State">
                            {business.state}
                          </DetailItem>
                          <div className="sm:col-span-2">
                            <DetailItem label="Created">
                              {formatDate(business.createdAt)}
                            </DetailItem>
                          </div>
                        </dl>
                        <Link
                          href="/businesses"
                          className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                          Manage business
                        </Link>
                      </>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    Account details
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                    Account metadata
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Technical account identifiers from Clerk. These are not
                    required for day-to-day use.
                  </p>

                  <dl className="mt-5 space-y-3">
                    <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        Member since
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {memberSince}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                      <dt className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        Clerk user ID
                      </dt>
                      <dd className="mt-2 flex min-w-0 items-center gap-2">
                        <code className="min-w-0 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                          {user?.id ? truncateId(user.id) : "Unavailable"}
                        </code>
                        {user?.id && (
                          <button
                            type="button"
                            onClick={() => void copyUserId()}
                            className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {copied ? "Copied" : "Copy"}
                          </button>
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              <section
                id="manage-account"
                className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="max-w-2xl">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                    Manage account
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                    Clerk account management
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Update your name, email, password, sessions, and other
                    security controls using Clerk&apos;s account UI. GridSense
                    does not store a separate user profile for these settings.
                  </p>
                </div>

                <div className="mt-6 flex justify-center overflow-x-auto">
                  <UserProfile
                    path="/profile"
                    routing="path"
                    appearance={{
                      elements: {
                        rootBox: "w-full max-w-4xl",
                        cardBox: "w-full shadow-none",
                        card: "rounded-xl border border-slate-200 shadow-none dark:border-slate-700",
                        navbar: "rounded-l-xl",
                        scrollBox: "rounded-r-xl",
                      },
                    }}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
