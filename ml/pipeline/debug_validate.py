import pandas as pd
import numpy as np
import importlib.util
from pathlib import Path

MODULE_PATH = Path('ml/pipeline/08_validate_dataset.py').resolve()
SPEC = importlib.util.spec_from_file_location('VAL', MODULE_PATH)
VAL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VAL)


def make_business_month_df(n_businesses=3, months=4, start_year=2024, start_month=1):
    rows = []
    for b in range(n_businesses):
        business_id = f'B{b+1:03d}'
        for m in range(months):
            current_year = start_year + ((start_month + m - 1) // 12)
            current_month = ((start_month + m - 1) % 12) + 1
            total_energy_cost = 100.0 + m
            days_in_month = pd.to_datetime(
                {'year': [current_year], 'month': [current_month], 'day': [1]}
            ).dt.days_in_month.iloc[0]
            rows.append({
                'business_id': business_id,
                'record_id': f'R{b+1:03d}-{m+1:02d}',
                'year': current_year,
                'month': current_month,
                'electricity_bill': 50.0 + m,
                'diesel_cost': 10.0,
                'petrol_cost': 5.0,
                'generator_hours': 5.0,
                'grid_hours': 100.0,
                'outage_hours': 1.0,
                'energy_consumption_kwh': 500.0,
                'fuel_consumption_liters': 50.0,
                'maintenance_cost': 5.0,
                'total_energy_cost': total_energy_cost,
                'monthly_revenue': 10000.0,
                'employees': 10,
                'floor_area_sqm': 100.0,
                'solar_capacity_kw': 10.0,
                'occupancy_rate': 50.0,
                'operating_hours': 10.0,
                'business_type': 'Factory',
                'energy_source': 'Generator',
                'business_name': f'Business {business_id}',
                'industry': 'Manufacturing',
                'state': 'State',
                'city': 'City',
                'created_at': '2024-01-01',
                'quarter': ((current_month - 1) // 3) + 1,
                'cost_per_kwh': total_energy_cost / 500.0,
                'energy_cost_per_employee': total_energy_cost / 10.0,
                'generator_dependency': 5.0 / 105.0,
                'revenue_energy_ratio': 10000.0 / total_energy_cost,
                'outage_severity': 1.0 / (10.0 * days_in_month),
                'estimated_carbon_intensity': 50.0 / 500.0,
                'next_month_energy_cost': np.nan,
            })
    df = pd.DataFrame(rows)
    df = df.sort_values(['business_id', 'year', 'month']).reset_index(drop=True)
    df['next_month_energy_cost'] = df.groupby('business_id')['total_energy_cost'].shift(-1)
    return df


df = make_business_month_df(3, 4)
report, ok = VAL.validate(df, expected_businesses=3, expected_months=4)
print('OK', ok)
print('Passed', report['passed_checks'])
print('Failed', report['failed_checks'])
print('Warnings', report['warning_checks'])
print('Target checks', report['target_checks'])
if not ok:
    import json
    print(json.dumps(report, indent=2))
