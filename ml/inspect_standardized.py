# from pathlib import Path
# import pandas as pd


# # Project's ml directory
# ML_ROOT = Path(__file__).resolve().parent

# # Standardized datasets
# STANDARDIZED_DIR = ML_ROOT / "datasets" / "standardized"


# print("=" * 70)
# print("GRID SENSE AI — STANDARDIZED DATASET COLUMNS")
# print("=" * 70)

# if not STANDARDIZED_DIR.exists():
#     print(f"\n❌ Folder not found:")
#     print(STANDARDIZED_DIR)
#     raise SystemExit

# files = sorted(STANDARDIZED_DIR.glob("*.csv"))

# if not files:
#     print(f"\n❌ No CSV files found in:")
#     print(STANDARDIZED_DIR)
#     raise SystemExit

# for file in files:

#     print("\n" + "=" * 70)
#     print(file.name)
#     print("=" * 70)

#     try:
#         df = pd.read_csv(file, nrows=0)

#         print(f"Columns: {len(df.columns)}")
#         print()

#         for i, column in enumerate(df.columns, start=1):
#             print(f"{i:2}. {column}")

#     except Exception as error:
#         print(f"❌ Could not inspect file: {error}")


# print("\n" + "=" * 70)
# print("INSPECTION COMPLETE")
# print("=" * 70)

# from pathlib import Path
# import pandas as pd

# file = Path("datasets/standardized/cbecs2018_final_public.csv")

# df = pd.read_csv(file, nrows=0)

# for i, column in enumerate(df.columns[:350], start=1):
#     print(f"{i}. {column}")

import pandas as pd; df=pd.read_csv('datasets/standardized/cbecs2018_final_public.csv'); cols=df.columns[:249]; print('\n'.join(f'{i}. {c} | dtype={df[c].dtype} | non_null={df[c].notna().sum()}' for i,c in enumerate(cols,1)))