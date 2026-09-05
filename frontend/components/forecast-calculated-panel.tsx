import { GesReadout } from "@/components/ges-readout";
import {
  formatForecastCurrency,
  formatForecastPercent,
} from "@/lib/forecast-scenario";
import { type DerivedEnergyMetrics } from "@/lib/energy-record-pipeline";
import { type GesV1Result } from "@/lib/ges-v1";

type ForecastCalculatedPanelProps = {
  electricityBill: number;
  dieselCost: number;
  petrolCost: number;
  derivedMetrics: DerivedEnergyMetrics;
  ges: GesV1Result;
};

export function ForecastCalculatedPanel({
  electricityBill,
  dieselCost,
  petrolCost,
  derivedMetrics,
  ges,
}: ForecastCalculatedPanelProps) {
  return (
    <section className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 sm:p-5 dark:border-emerald-800 dark:bg-emerald-950/20">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        Calculated by GridSense
      </h3>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
        These values update as you type. They cannot be edited directly.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            Electricity
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {formatForecastCurrency(electricityBill)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Diesel</dt>
          <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {formatForecastCurrency(dieselCost)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Petrol</dt>
          <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {formatForecastCurrency(petrolCost)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-emerald-200/80 pt-4 dark:border-emerald-800">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">
              Total energy cost
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
              {formatForecastCurrency(derivedMetrics.totalEnergyCost)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">
              Cost per kWh
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              {formatForecastCurrency(derivedMetrics.costPerKwh)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">
              Generator dependency
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              {formatForecastPercent(derivedMetrics.generatorDependency * 100)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4">
        <GesReadout result={ges} showHelper={false} />
      </div>
    </section>
  );
}
