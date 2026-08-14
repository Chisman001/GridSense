# from pathlib import Path

# import pandas as pd

# from config import CLEANED_DATA_DIR
# from utils import print_section


# def load_cleaned_dataset(filename: str) -> pd.DataFrame:
#     dataset_path = CLEANED_DATA_DIR / filename

#     if not dataset_path.exists():
#         raise FileNotFoundError(
#             f"Cleaned dataset not found: {dataset_path}\n"
#             "Run the cleaning stage first or verify CLEANED_DATA_DIR."
#         )

#     return pd.read_csv(dataset_path)


# def main():
#     print_section("MERGE DATASETS")

#     energy_complete = load_cleaned_dataset("energydata_complete.csv")
#     smart_meter = load_cleaned_dataset("smart_meter_data.csv")

#     print("Energy Complete:")
#     print(energy_complete.shape)
#     print(energy_complete.columns.tolist())

#     print("\nSmart Meter:")
#     print(smart_meter.shape)
#     print(smart_meter.columns.tolist())

#     print("\nAre columns identical?")
#     print(
#         energy_complete.columns.tolist()
#         == smart_meter.columns.tolist()
#     )

#     print("\nAre the datasets identical?")
#     print(
#         energy_complete.equals(smart_meter)
#     )


# if __name__ == "__main__":
#     main()

from pathlib import Path
import pandas as pd

folder = Path("datasets/standardized")

for file in folder.glob("*.csv"):
    df = pd.read_csv(file, nrows=0)

    print("\n" + "=" * 70)
    print(file.name)
    print("=" * 70)

    print(list(df.columns))