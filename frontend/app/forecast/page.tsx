"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ForecastCalculatedPanel } from "@/components/forecast-calculated-panel";
import { ForecastDrivers } from "@/components/forecast-drivers";
import { ForecastResultCard } from "@/components/forecast-result-card";
import { WhatIfSimulator } from "@/components/what-if-simulator";
import {
  BUSINESS_STATES,
  BUSINESS_TYPES,
  ENERGY_SOURCES,
  INDUSTRIES,
  optionsIncluding,
  parseBusinessResponse,
  type BusinessProfile,
} from "@/lib/business-profile";
import {
  formatInputNumber,
  parseFormattedNumber,
  toEditableNumberString,
} from "@/lib/format-number";
import {
  calculateGES,
  GES_V1_MAX_OPERATING_HOURS_PER_DAY,
} from "@/lib/ges-v1";
import { deriveEnergyMetrics } from "@/lib/energy-record-pipeline";
import {
  buildForecastDrivers,
  parseForecastPrediction,
  rawEnergyRecordsEqual,
  type ForecastPrediction,
} from "@/lib/forecast-scenario";

// Typical SME day. Not derived from the old monthly-shaped demo default of 600.
const DEFAULT_OPERATING_HOURS_PER_DAY = 12;

function createInitialForecastForm() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return {
    business_type: "",
    industry: "",
    state: "",
    energy_source: "",

    year,
    month,

    electricity_bill: 0,
    diesel_cost: 0,
    petrol_cost: 0,

    energy_consumption_kwh: 0,
    fuel_consumption_liters: 0,

    generator_hours: 0,
    grid_hours: 0,
    outage_hours: 0,
    operating_hours_per_day: DEFAULT_OPERATING_HOURS_PER_DAY,

    employees: 0,
    occupancy_rate: 0,

    floor_area_sqm: 0,
    solar_capacity_kw: 0,
    renewable_energy_percentage: 0,

    maintenance_cost: 0,
    monthly_revenue: 0,

    weather_avg_temp: 0,
  };
}

type EnergyRecordPrefill = {
  year: number;
  month: number;
  quarter: number;
  energySource: string;
  electricityBill: number;
  dieselCost: number;
  petrolCost: number;
  totalEnergyCost: number;
  energyConsumptionKwh: number;
  fuelConsumptionLiters: number;
  generatorHours: number;
  gridHours: number;
  outageHours: number;
  operatingHours: number;
  employeeCount: number;
  employees: number;
  occupancyRate: number;
  floorAreaSqm: number;
  solarCapacityKw: number;
  renewableEnergyPercentage: number;
  maintenanceCost: number;
  monthlyRevenue: number;
  energyCostPerEmployee: number;
  costPerKwh: number;
  averageMonthlyEnergyCost: number;
  generatorDependency: number;
  revenueEnergyRatio: number;
  outageSeverity: number;
  weatherAvgTemp: number;
  estimatedCarbonIntensity: number;
};

function formatPeriod(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

function prefillFromEnergyRecord(record: EnergyRecordPrefill) {
  return {
    year: record.year,
    month: record.month,
    energy_source: record.energySource,
    electricity_bill: record.electricityBill,
    diesel_cost: record.dieselCost,
    petrol_cost: record.petrolCost,
    energy_consumption_kwh: record.energyConsumptionKwh,
    fuel_consumption_liters: record.fuelConsumptionLiters,
    generator_hours: record.generatorHours,
    grid_hours: record.gridHours,
    outage_hours: record.outageHours,
    operating_hours_per_day:
      record.operatingHours > 0 && record.operatingHours <= 24
        ? record.operatingHours
        : DEFAULT_OPERATING_HOURS_PER_DAY,
    employees: record.employees,
    occupancy_rate: record.occupancyRate,
    floor_area_sqm: record.floorAreaSqm,
    solar_capacity_kw: record.solarCapacityKw,
    renewable_energy_percentage: record.renewableEnergyPercentage,
    maintenance_cost: record.maintenanceCost,
    monthly_revenue: record.monthlyRevenue,
    weather_avg_temp: record.weatherAvgTemp,
  };
}

function rawForecastPayload(form: ReturnType<typeof createInitialForecastForm>) {
  return {
    year: form.year,
    month: form.month,
    energySource: form.energy_source,
    electricityBill: form.electricity_bill,
    dieselCost: form.diesel_cost,
    petrolCost: form.petrol_cost,
    energyConsumptionKwh: form.energy_consumption_kwh,
    fuelConsumptionLiters: form.fuel_consumption_liters,
    generatorHours: form.generator_hours,
    gridHours: form.grid_hours,
    outageHours: form.outage_hours,
    operatingHours: form.operating_hours_per_day,
    employees: form.employees,
    occupancyRate: form.occupancy_rate,
    floorAreaSqm: form.floor_area_sqm,
    solarCapacityKw: form.solar_capacity_kw,
    renewableEnergyPercentage: form.renewable_energy_percentage,
    maintenanceCost: form.maintenance_cost,
    monthlyRevenue: form.monthly_revenue,
    weatherAvgTemp: form.weather_avg_temp,
  };
}

function toFriendlyPredictionError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound")
  ) {
    return "The forecast service is temporarily unavailable. Check your connection and try again.";
  }

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "The forecast request timed out. Please try again in a moment.";
  }

  return message;
}

type AIInsights = {
  summary: string;
  key_insights: string[];
  recommendations: string[];
  risk_level: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJsonResponse(
  response: Response,
  label: string
): Promise<unknown> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(
      `${label} returned invalid JSON: ${responseText.slice(0, 200)}`
    );
  }
}

function getErrorMessage(
  payload: unknown,
  fallback: string
): string {
  if (!isRecord(payload)) {
    return fallback;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (
    isRecord(payload.detail) &&
    typeof payload.detail.message === "string"
  ) {
    return payload.detail.message;
  }

  return fallback;
}

function parseInsights(payload: unknown): AIInsights {
  if (
    !isRecord(payload) ||
    typeof payload.summary !== "string" ||
    !Array.isArray(payload.key_insights) ||
    !payload.key_insights.every((item) => typeof item === "string") ||
    !Array.isArray(payload.recommendations) ||
    !payload.recommendations.every((item) => typeof item === "string") ||
    typeof payload.risk_level !== "string"
  ) {
    throw new Error("Insights API returned an invalid response.");
  }

  return {
    summary: payload.summary,
    key_insights: payload.key_insights,
    recommendations: payload.recommendations,
    risk_level: payload.risk_level,
  };
}

function getSavedPredictionId(payload: unknown): string {
  if (
    !isRecord(payload) ||
    !isRecord(payload.prediction) ||
    typeof payload.prediction.id !== "string"
  ) {
    throw new Error("Save API returned an invalid response.");
  }

  return payload.prediction.id;
}

async function fetchBusinessProfile(): Promise<BusinessProfile | null> {
  const response = await fetch("/api/business", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await readJsonResponse(response, "Business API");

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, "Failed to load business profile.")
    );
  }

  return parseBusinessResponse(payload);
}

export default function ForecastPage() {
  return (
    <Suspense
      fallback={
        <main className="bg-slate-50 dark:bg-transparent dark:text-slate-100">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Loading forecast...
            </p>
          </div>
        </main>
      }
    >
      <ForecastPageContent />
    </Suspense>
  );
}

function ForecastPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = searchParams.get("recordId");

  const [insights, setInsights] =
    useState<AIInsights | null>(null);

  const [insightsLoading, setInsightsLoading] =
    useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [savedPredictionId, setSavedPredictionId] =
    useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [profileError, setProfileError] = useState("");

  const [form, setForm] = useState(createInitialForecastForm);
  const [prefillNotice, setPrefillNotice] = useState("");
  const [prefillError, setPrefillError] = useState("");
  const [forecastBlocked, setForecastBlocked] = useState(false);

  const derivedMetrics = useMemo(
    () => deriveEnergyMetrics(rawForecastPayload(form)),
    [form]
  );

  const ges = useMemo(() => {
    if (form.operating_hours_per_day > GES_V1_MAX_OPERATING_HOURS_PER_DAY) {
      return {
        available: false as const,
        reason: "operating_hours_invalid" as const,
      };
    }

    return calculateGES({
      totalEnergyCost: derivedMetrics.totalEnergyCost,
      monthlyRevenue: form.monthly_revenue,
      generatorHours: form.generator_hours,
      gridHours: form.grid_hours,
      outageHours: form.outage_hours,
      operatingHours: form.operating_hours_per_day,
      year: form.year,
      month: form.month,
    });
  }, [
    derivedMetrics.totalEnergyCost,
    form.monthly_revenue,
    form.generator_hours,
    form.grid_hours,
    form.outage_hours,
    form.operating_hours_per_day,
    form.year,
    form.month,
  ]);

  const [baselineResult, setBaselineResult] =
    useState<ForecastPrediction | null>(null);
  const [baselineRawPayload, setBaselineRawPayload] = useState<
    ReturnType<typeof rawForecastPayload> | null
  >(null);
  const [forecastSessionId, setForecastSessionId] = useState(0);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  const currentRawPayload = useMemo(() => rawForecastPayload(form), [form]);
  const inputsChanged =
    baselineRawPayload !== null &&
    !rawEnergyRecordsEqual(currentRawPayload, baselineRawPayload);

  const baselineDrivers = useMemo(() => {
    if (!baselineRawPayload) {
      return [];
    }

    const derived = deriveEnergyMetrics(baselineRawPayload);
    return buildForecastDrivers(
      baselineRawPayload,
      derived,
      calculateGES({
        totalEnergyCost: derived.totalEnergyCost,
        monthlyRevenue: baselineRawPayload.monthlyRevenue,
        generatorHours: baselineRawPayload.generatorHours,
        gridHours: baselineRawPayload.gridHours,
        outageHours: baselineRawPayload.outageHours,
        operatingHours: baselineRawPayload.operatingHours,
        year: baselineRawPayload.year,
        month: baselineRawPayload.month,
      })
    );
  }, [baselineRawPayload]);

  function updateField(
    field: string,
    value: string | number
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  const applyBusinessProfile = useCallback((profile: BusinessProfile | null) => {
    if (!profile) {
      setBusiness(null);
      setProfileStatus("missing");
      return;
    }

    setBusiness(profile);
    setForm((previous) => ({
      ...previous,
      business_type: profile.businessType,
      industry: profile.industry,
      state: profile.state,
    }));
    setProfileStatus("ready");
  }, []);

  async function loadBusinessProfile() {
    setProfileStatus("loading");
    setProfileError("");
    setBusiness(null);

    try {
      applyBusinessProfile(await fetchBusinessProfile());
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Failed to load business profile."
      );
      setProfileStatus("error");
    }
  }

  async function loadEnergyRecordPrefill(selectedRecordId: string | null) {
    setPrefillNotice("");
    setPrefillError("");
    setForecastBlocked(false);

    try {
      const response = await fetch("/api/energy-records", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        if (selectedRecordId) {
          setPrefillError("The energy record could not be loaded.");
        }
        return;
      }

      const payload = await readJsonResponse(response, "Energy records API");
      if (!isRecord(payload) || !Array.isArray(payload.records)) {
        if (selectedRecordId) {
          setPrefillError("The energy record could not be loaded.");
        }
        return;
      }

      const records = payload.records.filter(isRecord);
      const selected = selectedRecordId
        ? records.find(
            (record) =>
              typeof record.id === "string" && record.id === selectedRecordId
          )
        : records[0];

      if (!selected) {
        if (selectedRecordId) {
          setPrefillError("That energy record could not be found.");
        }
        return;
      }

      if (selected.hasLinkedPrediction === true) {
        if (selectedRecordId) {
          setForecastBlocked(true);
          setPrefillError(
            `A forecast already exists for ${formatPeriod(
              Number(selected.year),
              Number(selected.month)
            )}. Open Reports to view it.`
          );
          return;
        }

        setPrefillNotice(
          `Pre-filled from ${formatPeriod(Number(selected.year), Number(selected.month))}. A forecast already exists for this period — change the month or open Reports.`
        );
        setForm((previous) => ({
          ...previous,
          ...prefillFromEnergyRecord(selected as EnergyRecordPrefill),
        }));
        return;
      }

      setForm((previous) => ({
        ...previous,
        ...prefillFromEnergyRecord(selected as EnergyRecordPrefill),
      }));
      setPrefillNotice(
        `Pre-filled from ${formatPeriod(Number(selected.year), Number(selected.month))}. Review, then generate the forecast.`
      );
    } catch {
      if (selectedRecordId) {
        setPrefillError("The energy record could not be loaded.");
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    void fetchBusinessProfile()
      .then(async (profile) => {
        if (!cancelled) {
          applyBusinessProfile(profile);
          if (profile) {
            await loadEnergyRecordPrefill(recordId);
          }
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setProfileError(
          error instanceof Error
            ? error.message
            : "Failed to load business profile."
        );
        setProfileStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [applyBusinessProfile, recordId]);

  async function generateAndPersistInsights(
    prediction: ForecastPrediction,
    predictionId: string
  ) {
    setInsightsLoading(true);
    setInsightsError("");

    try {
      const insightsResponse = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          prediction:
            prediction.predicted_next_month_energy_cost,
          analytics: prediction.analytics ?? {},
        }),
      });

      const insightsPayload = await readJsonResponse(
        insightsResponse,
        "Insights API"
      );

      if (!insightsResponse.ok) {
        throw new Error(
          getErrorMessage(
            insightsPayload,
            "AI insights are temporarily unavailable."
          )
        );
      }

      const generatedInsights = parseInsights(insightsPayload);
      setInsights(generatedInsights);

      const persistResponse = await fetch(
        `/api/forecasts/${encodeURIComponent(
          predictionId
        )}/insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            aiInsights: generatedInsights,
          }),
        }
      );

      const persistPayload = await readJsonResponse(
        persistResponse,
        "Insights save API"
      );

      if (!persistResponse.ok) {
        throw new Error(
          getErrorMessage(
            persistPayload,
            "AI insights were generated but could not be saved."
          )
        );
      }
    } catch (err) {
      setInsightsError(
        err instanceof Error
          ? err.message
          : "AI insights are temporarily unavailable."
      );
    } finally {
      setInsightsLoading(false);
    }
  }

  function validateForecastInputs(): string | null {
    if (forecastBlocked) {
      return "A forecast already exists for this period. Open Reports to view it.";
    }

    if (!business) {
      return "Complete your business profile before generating a forecast.";
    }

    if (!form.energy_source.trim()) {
      return "Select an energy source for this forecast.";
    }

    return null;
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForecastInputs();
    if (validationError) {
      setPredictionError(validationError);
      return;
    }

    setPredictionLoading(true);
    setPredictionError("");
    setSaveError("");
    setInsightsError("");
    setInsights(null);
    setSavedPredictionId(null);
    setBaselineResult(null);
    setBaselineRawPayload(null);

    const forecastPayload = rawForecastPayload(form);

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(forecastPayload),
      });

      const predictionPayload = await readJsonResponse(
        response,
        "Prediction API"
      );

      if (!response.ok) {
        throw new Error(
          toFriendlyPredictionError(
            getErrorMessage(
              predictionPayload,
              "The forecast could not be generated. Please check your inputs and try again."
            )
          )
        );
      }

      const prediction = parseForecastPrediction(predictionPayload);
      setBaselineResult(prediction);
      setBaselineRawPayload(forecastPayload);
      setForecastSessionId((current) => current + 1);
    } catch (err) {
      setPredictionError(
        toFriendlyPredictionError(
          err instanceof Error ? err.message : "Something went wrong."
        )
      );
    } finally {
      setPredictionLoading(false);
    }
  }

  async function handleSave() {
    const validationError = validateForecastInputs();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    if (!baselineResult || !baselineRawPayload) {
      setSaveError("Generate a forecast before saving.");
      return;
    }

    if (savedPredictionId) {
      return;
    }

    setSaveLoading(true);
    setSaveError("");
    setInsightsError("");

    try {
      const saveResponse = await fetch("/api/forecasts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          form: baselineRawPayload,
          prediction: baselineResult,
        }),
      });

      const savePayload = await readJsonResponse(saveResponse, "Save API");

      if (!saveResponse.ok) {
        throw new Error(
          getErrorMessage(savePayload, "Failed to save forecast.")
        );
      }

      const predictionId = getSavedPredictionId(savePayload);
      setSavedPredictionId(predictionId);
      await generateAndPersistInsights(baselineResult, predictionId);
    } catch (err) {
      setSaveError(
        toFriendlyPredictionError(
          err instanceof Error ? err.message : "Failed to save forecast."
        )
      );
    } finally {
      setSaveLoading(false);
    }
  }

  async function retryInsights() {
    if (!baselineResult || !savedPredictionId) {
      return;
    }

    await generateAndPersistInsights(baselineResult, savedPredictionId);
  }

  return (
    <main className="bg-slate-50 dark:bg-transparent dark:text-slate-100">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* Page heading */}
        <section className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-4 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            ← Back to Dashboard
          </button>

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            Forecast
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            Generate a New Forecast
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Enter your latest energy and operational facts. GridSense
            calculates totals, ratios, and the GridSense Energy Score, then
            forecasts next-month energy cost.
          </p>
        </section>

        {prefillNotice && profileStatus === "ready" && !forecastBlocked && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            {prefillNotice}
          </div>
        )}

        {prefillError && profileStatus === "ready" && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <p>{prefillError}</p>
            {forecastBlocked && (
              <Link
                href="/reports"
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300"
              >
                Open Reports
              </Link>
            )}
          </div>
        )}

        {profileStatus === "loading" && (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Loading business profile...
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
              Your registered business details will appear here once they load.
            </p>
          </section>
        )}

        {profileStatus === "error" && (
          <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/60 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Unable to load your business profile
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
              {profileError || "The business profile could not be loaded."}
            </p>
            <button
              type="button"
              onClick={() => void loadBusinessProfile()}
              className="mt-5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-emerald-400 dark:text-slate-950"
            >
              Try again
            </button>
          </section>
        )}

        {profileStatus === "missing" && (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Complete your business profile
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600 dark:text-slate-400">
              Forecasts use your registered business type, industry, and state.
              Set up your profile before generating a forecast.
            </p>
            <Link
              href="/onboarding"
              className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-emerald-400 dark:text-slate-950"
            >
              Set up business profile
            </Link>
          </section>
        )}

        {profileStatus === "ready" && business && !forecastBlocked && (
        <>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form */}
          <form
            onSubmit={handleGenerate}
            className="space-y-5 lg:col-span-2"
          >
            {/* Business Profile */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Step 1
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    Business Profile
                  </h2>

                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    These values come from your registered business, {business.businessName}.
                  </p>
                </div>
                <Link
                  href="/businesses"
                  className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Edit business profile
                </Link>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Business Type"
                  value={form.business_type}
                  options={optionsIncluding(BUSINESS_TYPES, form.business_type)}
                  disabled
                />

                <SelectField
                  label="Industry"
                  value={form.industry}
                  options={optionsIncluding(INDUSTRIES, form.industry)}
                  disabled
                />

                <SelectField
                  label="State"
                  value={form.state}
                  options={optionsIncluding(BUSINESS_STATES, form.state)}
                  disabled
                />

                <SelectField
                  label="Energy Source"
                  value={form.energy_source}
                  options={ENERGY_SOURCES}
                  placeholder="Select energy source"
                  onChange={(value) => updateField("energy_source", value)}
                />
              </div>
            </section>

            {/* Forecast Period */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Step 2
                </p>

                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  Forecast Period
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Select the period this forecast is based on.
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <NumberField
                  label="Year"
                  value={form.year}
                  formatted
                  onChange={(value) =>
                    updateField("year", value)
                  }
                />

                <NumberField
                  label="Month"
                  value={form.month}
                  formatted
                  min={1}
                  max={12}
                  onChange={(value) =>
                    updateField("month", value)
                  }
                />
              </div>
            </section>

            {/* Energy Costs */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Step 3
                </p>

                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  Energy Costs & Consumption
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Enter your recent energy spending and consumption.
                </p>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <NumberField
                  label="Electricity Bill (₦)"
                  value={form.electricity_bill}
                  formatted
                  onChange={(value) =>
                    updateField("electricity_bill", value)
                  }
                />

                <NumberField
                  label="Diesel Cost (₦)"
                  value={form.diesel_cost}
                  formatted
                  onChange={(value) =>
                    updateField("diesel_cost", value)
                  }
                />

                <NumberField
                  label="Petrol Cost (₦)"
                  value={form.petrol_cost}
                  formatted
                  onChange={(value) =>
                    updateField("petrol_cost", value)
                  }
                />

                <NumberField
                  label="Energy Consumption (kWh)"
                  value={form.energy_consumption_kwh}
                  formatted
                  onChange={(value) =>
                    updateField(
                      "energy_consumption_kwh",
                      value
                    )
                  }
                />

                <NumberField
                  label="Fuel Consumption (Litres)"
                  value={form.fuel_consumption_liters}
                  formatted
                  onChange={(value) =>
                    updateField(
                      "fuel_consumption_liters",
                      value
                    )
                  }
                />
              </div>
            </section>

            {/* Operations & Reliability */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Step 4
                </p>

                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  Operations & Reliability
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Describe your operating hours and power reliability.
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <NumberField
                  label="Generator Hours"
                  value={form.generator_hours}
                  formatted
                  onChange={(value) =>
                    updateField("generator_hours", value)
                  }
                />

                <NumberField
                  label="Grid Hours"
                  value={form.grid_hours}
                  formatted
                  onChange={(value) =>
                    updateField("grid_hours", value)
                  }
                />

                <NumberField
                  label="Outage Hours"
                  value={form.outage_hours}
                  formatted
                  onChange={(value) =>
                    updateField("outage_hours", value)
                  }
                />

                <NumberField
                  label="Operating Hours per Day"
                  value={form.operating_hours_per_day}
                  formatted
                  decimals={2}
                  min={0}
                  max={GES_V1_MAX_OPERATING_HOURS_PER_DAY}
                  onChange={(value) =>
                    updateField("operating_hours_per_day", value)
                  }
                />
              </div>
            </section>

            {/* Business Performance */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Step 5
                </p>

                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  Business Performance
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Provide information about your business operations and financial performance.
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <NumberField
                  label="Monthly Revenue (₦)"
                  value={form.monthly_revenue}
                  formatted
                  onChange={(value) =>
                    updateField("monthly_revenue", value)
                  }
                />

                <NumberField
                  label="Maintenance Cost (₦)"
                  value={form.maintenance_cost}
                  formatted
                  onChange={(value) =>
                    updateField("maintenance_cost", value)
                  }
                />

                <NumberField
                  label="Employees"
                  value={form.employees}
                  formatted
                  onChange={(value) =>
                    updateField("employees", value)
                  }
                />

                <NumberField
                  label="Occupancy Rate (%)"
                  value={form.occupancy_rate}
                  formatted
                  onChange={(value) =>
                    updateField("occupancy_rate", value)
                  }
                />

                <NumberField
                  label="Floor Area (m²)"
                  value={form.floor_area_sqm}
                  formatted
                  onChange={(value) =>
                    updateField("floor_area_sqm", value)
                  }
                />
              </div>
            </section>

            {/* Efficiency & Sustainability */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Step 6
                </p>

                <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  Efficiency & Sustainability
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Add renewable energy and environmental information.
                </p>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <NumberField
                  label="Solar Capacity (kW)"
                  value={form.solar_capacity_kw}
                  formatted
                  decimals={2}
                  onChange={(value) =>
                    updateField("solar_capacity_kw", value)
                  }
                />

                <NumberField
                  label="Renewable Energy (%)"
                  value={form.renewable_energy_percentage}
                  formatted
                  onChange={(value) =>
                    updateField(
                      "renewable_energy_percentage",
                      value
                    )
                  }
                />

                <NumberField
                  label="Average Temperature (°C)"
                  value={form.weather_avg_temp}
                  formatted
                  decimals={1}
                  onChange={(value) =>
                    updateField("weather_avg_temp", value)
                  }
                />
              </div>
            </section>

            <ForecastCalculatedPanel
              electricityBill={form.electricity_bill}
              dieselCost={form.diesel_cost}
              petrolCost={form.petrol_cost}
              derivedMetrics={derivedMetrics}
              ges={ges}
            />

            {inputsChanged && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Inputs changed — regenerate forecast to update the baseline.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={predictionLoading || saveLoading}
                className="w-full rounded-xl bg-gray-900 px-6 py-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300"
              >
                {predictionLoading ? "Generating Forecast..." : "Generate Forecast"}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={
                  !baselineResult ||
                  Boolean(savedPredictionId) ||
                  predictionLoading ||
                  saveLoading ||
                  insightsLoading
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-6 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              >
                {saveLoading
                  ? "Saving Forecast..."
                  : insightsLoading
                    ? "Saving AI Insights..."
                    : savedPredictionId
                      ? "Forecast Saved"
                      : "Save Forecast"}
              </button>
            </div>

            {predictionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {predictionError}
              </div>
            )}
          </form>

          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {!baselineResult && !predictionLoading && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                  Next month forecast
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Generate a forecast to see next-month cost, the main
                  conditions behind it, and unlock the what-if scenario.
                </p>
              </div>
            )}

            {predictionLoading && !baselineResult && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Running GridSense LightGBM model...
                </p>
              </div>
            )}

            {baselineResult && (
              <>
                <ForecastResultCard result={baselineResult} />
                <ForecastDrivers drivers={baselineDrivers} />

                {saveLoading && (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    Saving forecast...
                  </div>
                )}

                {savedPredictionId && !saveError && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300">
                    Forecast saved successfully.
                  </div>
                )}

                {saveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {saveError}
                  </div>
                )}

                {(savedPredictionId || insightsLoading || insightsError || insights) && (
                  <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      AI INSIGHTS
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                      What this means
                    </h3>

                    {insightsLoading && (
                      <p className="mt-5 text-sm text-gray-500 dark:text-slate-400">
                        Gemini is analyzing your forecast...
                      </p>
                    )}

                    {insightsError && (
                      <div className="mt-5 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/60 dark:bg-yellow-950/40">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          {insightsError}
                        </p>
                        {savedPredictionId && (
                          <button
                            type="button"
                            onClick={() => void retryInsights()}
                            disabled={insightsLoading}
                            className="mt-3 text-sm font-semibold text-yellow-900 underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-yellow-300"
                          >
                            Retry AI insights
                          </button>
                        )}
                      </div>
                    )}

                    {insights && (
                      <div className="mt-5 space-y-5">
                        <p className="text-sm leading-6 text-gray-700 dark:text-slate-300">
                          {insights.summary}
                        </p>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                            Risk Level
                          </p>
                          <span className="mt-2 inline-flex rounded-full bg-yellow-50 px-3 py-1 text-sm font-medium text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300">
                            {insights.risk_level}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Key Insights
                          </p>
                          <ul className="mt-2 space-y-2">
                            {insights.key_insights.map((insight, index) => (
                              <li
                                key={index}
                                className="text-sm leading-6 text-gray-600 dark:text-slate-400"
                              >
                                • {insight}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Recommendations
                          </p>
                          <ul className="mt-2 space-y-2">
                            {insights.recommendations.map(
                              (recommendation, index) => (
                                <li
                                  key={index}
                                  className="text-sm leading-6 text-gray-600 dark:text-slate-400"
                                >
                                  • {recommendation}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>

        {baselineResult && baselineRawPayload && (
          <div className="mt-6">
            <WhatIfSimulator
              key={forecastSessionId}
              baselineRaw={baselineRawPayload}
              baselineResult={baselineResult}
              disabled={inputsChanged}
              disabledReason="Inputs changed — regenerate forecast to update the scenario baseline."
            />
          </div>
        )}
        </>
        )}
      </div>
    </main>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
        {label}
      </span>

      <select
        value={value}
        disabled={disabled}
        required={!disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900/40 dark:disabled:bg-slate-800 dark:disabled:text-slate-300"
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatted = false,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatted?: boolean;
  decimals?: number;
}) {
  const [editValue, setEditValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const inputClassName =
    "mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

  const clampValue = (next: number) => {
    let clamped = next;
    if (typeof min === "number") {
      clamped = Math.max(min, clamped);
    }
    if (typeof max === "number") {
      clamped = Math.min(max, clamped);
    }
    return clamped;
  };

  if (formatted) {
    const shownValue = isFocused
      ? editValue
      : formatInputNumber(value, decimals);

    return (
      <label className="block">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
          {label}
        </span>

        <input
          type="text"
          inputMode="decimal"
          value={shownValue}
          onFocus={() => {
            setIsFocused(true);
            setEditValue(toEditableNumberString(value, decimals));
          }}
          onChange={(event) => {
            setEditValue(event.target.value.replace(/[^\d.-]/g, ""));
          }}
          onBlur={() => {
            const parsed = clampValue(parseFormattedNumber(editValue));
            onChange(parsed);
            setIsFocused(false);
          }}
          className={inputClassName}
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
        {label}
      </span>

      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        className={inputClassName}
      />
    </label>
  );
}
