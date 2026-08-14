from llm_service import generate_energy_insights


test_context = {
    "prediction": 8091088.987486416,
    "analytics": {
        "current_energy_cost": 7500000,
        "predicted_energy_cost": 8091088.987486416,
        "predicted_change": 591088.9874864155,
        "predicted_change_percent": 7.881186499818874,
        "predicted_cost_per_employee": 80910.88987486415,
        "predicted_cost_per_kwh": 161.8217797497283,
        "generator_dependency_percent": 16.666666666666664,
        "outage_hours": 50,
        "predicted_energy_cost_as_percent_of_revenue": 26.97029662495472,
    },
}


result = generate_energy_insights(test_context)

print("\nGemini response:\n")

print(result)