"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { inputClasses, primaryButtonClasses, secondaryButtonClasses } from "@/components/ui/button-styles";
import { ABA_DEMO_PROFILE } from "@/lib/aba-demo-fixture";
import {
  BUSINESS_STATES,
  BUSINESS_TYPES,
  INDUSTRIES,
} from "@/lib/business-profile";

const ONBOARDING_STEPS = [
  { step: 1, title: "Business profile", description: "Create your business identity" },
  { step: 2, title: "Energy records", description: "Add monthly energy data" },
  { step: 3, title: "GridSense Energy Score", description: "See your performance score" },
  { step: 4, title: "Analyze & forecast", description: "Predict costs and get insights" },
];

const BUSINESS_UPDATED_EVENT = "gridsense:business-updated";

export function OnboardingForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    businessName: "",
    businessType: "",
    industry: "",
    state: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create business profile."
        );
      }

      const businessName =
        typeof data.business?.businessName === "string"
          ? data.business.businessName
          : form.businessName;

      window.dispatchEvent(
        new CustomEvent(BUSINESS_UPDATED_EVENT, {
          detail: { businessName },
        })
      );

      router.push("/energy-records");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-700 dark:text-emerald-300"
          >
            GridSense
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            Welcome to GridSense
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-400">
            Start your energy intelligence journey. First, tell us about your business.
          </p>
        </div>

        <ol className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ONBOARDING_STEPS.map((item) => (
            <li
              key={item.step}
              className={`rounded-xl border p-3 ${
                item.step === 1
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Step {item.step}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {item.description}
              </p>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Step 1 of 4
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
              Set up your business profile
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              This information personalizes forecasts, analytics, and reports.
            </p>
            <button
              type="button"
              onClick={() =>
                setForm({
                  businessName: ABA_DEMO_PROFILE.businessName,
                  businessType: ABA_DEMO_PROFILE.businessType,
                  industry: ABA_DEMO_PROFILE.industry,
                  state: ABA_DEMO_PROFILE.state,
                })
              }
              className={`mt-4 ${secondaryButtonClasses}`}
            >
              Use Aba demo profile
            </button>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Fills {ABA_DEMO_PROFILE.businessName} · {ABA_DEMO_PROFILE.businessType} ·{" "}
              {ABA_DEMO_PROFILE.state}. You still submit the form.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="businessName"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Business name
              </label>

              <input
                id="businessName"
                name="businessName"
                type="text"
                required
                value={form.businessName}
                onChange={handleChange}
                placeholder={ABA_DEMO_PROFILE.businessName}
                className={inputClasses}
              />
            </div>

            <div>
              <label
                htmlFor="businessType"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Business type
              </label>

              <select
                id="businessType"
                name="businessType"
                required
                value={form.businessType}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="" disabled>
                  Select business type
                </option>
                {BUSINESS_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="industry"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Industry
              </label>

              <select
                id="industry"
                name="industry"
                required
                value={form.industry}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="" disabled>
                  Select industry
                </option>
                {INDUSTRIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="state"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                State
              </label>

              <select
                id="state"
                name="state"
                required
                value={form.state}
                onChange={handleChange}
                className={inputClasses}
              >
                <option value="" disabled>
                  Select state
                </option>
                {BUSINESS_STATES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${primaryButtonClasses}`}
            >
              {loading
                ? "Creating business profile..."
                : "Continue to energy records"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
