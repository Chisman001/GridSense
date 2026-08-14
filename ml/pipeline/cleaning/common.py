"""
GridSense AI

Common Cleaning Utilities

Reusable functions shared across every dataset.
"""

import pandas as pd
import numpy as np
from datetime import datetime
from time import perf_counter

def remove_duplicates(df):

    before = len(df)

    df = df.drop_duplicates()

    removed = before - len(df)

    return df, removed
  
def remove_empty_rows(df):

    before = len(df)

    df = df.dropna(how="all")

    removed = before - len(df)

    return df, removed
  
def trim_strings(df):

    object_columns = df.select_dtypes(include="object").columns

    for column in object_columns:

        df[column] = (
            df[column]
            .astype(str)
            .str.strip()
        )

    return df
  
def standardize_column_names(df):

    df.columns = (

        df.columns

        .str.strip()

        .str.lower()

        .str.replace(" ", "_")

        .str.replace("-", "_")

        .str.replace("/", "_")

    )

    return df
  
def replace_missing_values(

    df,

    values=["?", "NA", "N/A", "null", "None"]

):

    return df.replace(values, np.nan)
  
def convert_numeric_columns(

    df,

    columns

):

    for column in columns:

        if column in df.columns:

            df[column] = pd.to_numeric(

                df[column],

                errors="coerce"

            )

    return df
  
def convert_datetime_columns(

    df,

    columns

):

    for column in columns:

        if column in df.columns:

            df[column] = pd.to_datetime(

                df[column],

                errors="coerce"

            )

    return df
  
def validate_numeric_range(

    df,

    column,

    minimum=None,

    maximum=None

):

    if column not in df.columns:

        return df

    if minimum is not None:

        df = df[df[column] >= minimum]

    if maximum is not None:

        df = df[df[column] <= maximum]

    return df
  
def validate_categories(
    df,
    column,
    valid_values,
    remove_invalid=False
):
    """
    Validate categorical values.

    Returns:
        df
        invalid_count
        invalid_values
        warning
    """

    if column not in df.columns:

        return df, 0, [], None

    invalid_mask = ~df[column].isin(valid_values)

    invalid_values = (
        df.loc[invalid_mask, column]
        .dropna()
        .unique()
        .tolist()
    )

    invalid_count = len(df.loc[invalid_mask])

    if remove_invalid:

        df = df.loc[~invalid_mask]

    warning = None

    if invalid_count > 0:

        warning = (
            f"{column}: "
            f"{invalid_count} invalid values "
            f"({invalid_values})"
        )

    return (
        df,
        invalid_count,
        invalid_values,
        warning
    )
    
def validate_unique_ids(
    df,
    column
):
    """
    Check duplicate IDs.

    Returns:
        duplicate_count
        warning
    """

    if column not in df.columns:

        return 0, None

    duplicate_count = (
        df[column]
        .duplicated()
        .sum()
    )

    warning = None

    if duplicate_count > 0:

        warning = (
            f"{duplicate_count} duplicate IDs "
            f"found in {column}"
        )

    return duplicate_count, warning
  

def validate_datetime_column(
    df,
    column
):
    """
    Validate that a datetime column contains valid timestamps.

    Returns:
        df
        invalid_count
        warning
    """

    if column not in df.columns:
        return df, 0, None

    invalid_mask = df[column].isna()
    invalid_count = int(invalid_mask.sum())

    warning = None
    if invalid_count > 0:
        warning = (
            f"{invalid_count} invalid datetime values found in {column}"
        )

    return df, invalid_count, warning
  

def validate_duplicate_timestamps(
    df,
    timestamp_column,
    id_column=None
):
    """
    Validates duplicate timestamp values optionally grouped by an ID column.

    Returns:
        duplicate_count
        warning
    """

    if timestamp_column not in df.columns:
        return 0, None

    if id_column and id_column not in df.columns:
        return 0, None

    if id_column:
        duplicate_mask = df.duplicated(subset=[id_column, timestamp_column])
    else:
        duplicate_mask = df.duplicated(subset=[timestamp_column])

    duplicate_count = int(duplicate_mask.sum())

    warning = None
    if duplicate_count > 0:
        warning = (
            f"{duplicate_count} duplicate timestamp rows found"
            f" for {timestamp_column}"
        )

    return duplicate_count, warning
  

def validate_required_columns(
    df,
    required_columns
):
    """
    Check that all required columns exist.
    """

    missing = []

    for column in required_columns:
        if column not in df.columns:
            missing.append(column)

    warning = None
    if missing:
        warning = (
            f"Missing required columns: "
            f"{missing}"
        )

    return missing, warning
  

def validate_ratio(
    df,
    numerator,
    denominator,
    maximum_ratio,
    description
):
    """
    Generic ratio validation.

    Example:
    Occupants per square metre.
    """

    if numerator not in df.columns:

        return 0, None

    if denominator not in df.columns:

        return 0, None

    ratio = (
        df[numerator] /
        df[denominator]
    )

    invalid = ratio > maximum_ratio

    count = invalid.sum()

    warning = None

    if count > 0:

        warning = (
            f"{count} suspicious "
            f"{description}"
        )

    return count, warning
  
def start_timer():

    return perf_counter()


def stop_timer(start):

    return round(
        perf_counter() - start,
        3
    )
  
def generate_report(

    dataset,

    before,

    after,

    duplicates,

    empty_rows,

    status="PASS",

    warnings=None,

    execution_time=None,

):

    warnings = warnings or []

    report = f"""

    GridSense AI

    Cleaning Report

    Dataset: {dataset}

    Generated: {datetime.now()}

    ----------------------------------------

    Rows Before: {before}

    Rows After: {after}

    Duplicates Removed: {duplicates}

    Empty Rows Removed: {empty_rows}

    Status: {status}

    """

    if execution_time is not None:
        report += f"Execution Time (s): {execution_time:.3f}\n\n"

    report += "\nWarnings\n"
    report += "-" * 40 + "\n"

    if warnings:
        for item in warnings:
            report += f"- {item}\n"
    else:
        report += "None\n"

    return report
