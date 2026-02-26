export const pythonCode = `
import numpy as np
import pandas as pd
from typing import Dict, Any

def summarize_common_metadata(x: pd.DataFrame, trials_expected: int) -> Dict[str, Any]:
    """
    Extract shared metadata and trial count checks from a grouped DataFrame.

    Args:
        x (pd.DataFrame): Grouped trial-level DataFrame.
        trials_expected (int): Expected number of trials.

    Returns:
        Dict[str, Any]: Summary metadata and quality flags.
    """
    if "trial_index" in x.columns:
        n_trials = x["trial_index"].nunique()
    else:
        # warnings.warn("No 'trial_index' column found; assuming single-trial task.")
        # For single-trial tasks (like Trailmaking), treat as one trial
        n_trials = 1
    return {
        "activity_begin_iso8601_timestamp": x["activity_begin_iso8601_timestamp"].iloc[
            0
        ],
        "n_trials": n_trials,
        "flag_trials_match_expected": n_trials == trials_expected,
        "flag_trials_lt_expected": n_trials < trials_expected,
        "flag_trials_gt_expected": n_trials > trials_expected,
    }

def score_shapes(row: pd.Series, method="accuracy"):
    """Score a single row of a color shapes task dataframe based on the method given.

    Args:
        row (pd.Series):
            A single row of a color shapes task dataframe containing the columns "user_response" and "user_response_correct".
        method (str, optional):
            The scoring method to use. Defaults to "accuracy". Can be "accuracy" or "signal".

    Returns:
        (str | None):
            If method is "accuracy", returns "CR", "MISS", "HIT", or "FA".
            If method is "signal", returns "SAME" or "DIFFERENT".
            Otherwise, returns None.

    Raises:
        Exception:
            If an error occurs while processing the row.

    """

    try:
        user_response_string = row["user_response"]
        user_response_correct = row["user_response_correct"]

        if user_response_string == "same" and user_response_correct:
            if method == "accuracy":
                return "CR"  # Correct Rejection
            elif method == "signal":
                return "SAME"

        elif user_response_string == "same" and not user_response_correct:
            if method == "accuracy":
                return "MISS"
            elif method == "signal":
                return "DIFFERENT"

        elif user_response_string == "different" and user_response_correct:
            if method == "accuracy":
                return "HIT"
            elif method == "signal":
                return "DIFFERENT"

        elif user_response_string == "different" and not user_response_correct:
            if method == "accuracy":
                return "FA"  # False Alarm
            elif method == "signal":
                return "SAME"

        else:
            # Return None on unexpected response combinations
            print(
                f"Unexpected response combination: user_response='{user_response_string}', user_response_correct='{user_response_correct}'"
            )
            return None

    except Exception as e:
        print(f"Error processing row: {e}")
        return None


def score_accuracy(row):
    """
    Scores the accuracy of the response for a single trial in the Color Shapes task.

    Args:
        row (pd.Series): A single row of the trial-level Color Shapes task dataframe.

    Returns:
        (str | None):
            A string indicating the accuracy of the response, such as "CR" for Correct Rejection,
            "MISS", "HIT", or "FA" for False Alarm, based on the scoring criteria.
            None is returned if an error occurs while processing the row.
    """

    return score_shapes(row, method="accuracy")


def score_signal(row):
    """
    Scores the signal type of the response for a single trial in the Color Shapes task.

    Args:
        row (pd.Series): A single row of the trial-level Color Shapes task dataframe.

    Returns:
        (str | None): A string indicating the signal type of the response, either "SAME" or "DIFFERENT",
            based on the scoring criteria.
            None is returned if an error occurs while processing the row.
    """

    return score_shapes(row, method="signal")


def summarize(x, trials_expected=10, rt_outlier_low=100, rt_outlier_high=10000):
    """
    Summarizes the Color Shapes task data by calculating various statistics.

    This function calculates the number of hits, misses, false alarms, and correct rejections
    based on the accuracy of responses in the Color Shapes task. It computes signal detection
    rates and evaluates response times, filtering out null, invalid, and outlier values.

    Args:
        x (pd.DataFrame): The trial-level scored dataset for the Color Shapes task.
        trials_expected (int, optional): The expected number of trials. Defaults to 10.
        rt_outlier_low (int, optional): The lower bound for filtering outliers in response times. Defaults to 100.
        rt_outlier_high (int, optional): The upper bound for filtering outliers in response times. Defaults to 10000.

    Returns:
        (pd.Series): A Pandas Series containing the summary statistics for the Color Shapes task.
    """

    d = summarize_common_metadata(x, trials_expected)
    
    # Number of accuracy hits, misses, false alarms, and correct rejections
    for metric in ["HIT", "MISS", "FA", "CR"]:
        d[f"n_trials_{metric}"] = (x["metric_accuracy"] == metric).sum()

    # Number of each trial type
    d["n_trials_type_same"] = (x["metric_trial_type"] == "SAME").sum()
    d["n_trials_type_different"] = (x["metric_trial_type"] == "DIFFERENT").sum()

    # Signal Detection Rates - with safe division for zero trial types
    if d["n_trials_type_different"] > 0:
        d["HIT_rate"] = d["n_trials_HIT"] / d["n_trials_type_different"]
        d["MISS_rate"] = 1 - d["HIT_rate"]
    else:
        d["HIT_rate"] = np.nan
        d["MISS_rate"] = np.nan

    if d["n_trials_type_same"] > 0:
        d["FA_rate"] = d["n_trials_FA"] / d["n_trials_type_same"]
        d["CR_rate"] = 1 - d["FA_rate"]
    else:
        d["FA_rate"] = np.nan
        d["CR_rate"] = np.nan

    # Response Times - Handle null/invalid response times first
    valid_rt_mask = pd.notna(x["response_time_duration_ms"]) & (
        x["response_time_duration_ms"] > 0
    )
    valid_rt_data = x.loc[valid_rt_mask, "response_time_duration_ms"]

    # Number of trials that had null/invalid response times
    d["n_trials_rt_invalid"] = (
        x["response_time_duration_ms"].shape[0] - valid_rt_data.shape[0]
    )

    # Overall Response Times (nulls/invalid removed only)
    d["median_rt_overall_valid"] = valid_rt_data.median()
    d["sd_rt_overall_valid"] = valid_rt_data.std()

    # Response Times by accuracy type (nulls/invalid removed only)
    for metric in ["HIT", "MISS", "FA", "CR"]:
        metric_mask = (x["metric_accuracy"] == metric) & valid_rt_mask
        rt_signal = x.loc[metric_mask, "response_time_duration_ms"]
        d[f"median_rt_{metric}_valid"] = rt_signal.median()
        d[f"sd_rt_{metric}_valid"] = rt_signal.std()

    # Filtered Overall Response Times (nulls/invalid and outliers removed)
    rt_filtered_overall = x.loc[
        valid_rt_mask
        & (x["response_time_duration_ms"] >= rt_outlier_low)
        & (x["response_time_duration_ms"] <= rt_outlier_high),
        "response_time_duration_ms",
    ]
    d["median_rt_overall_valid_filtered"] = rt_filtered_overall.median()
    d["sd_rt_overall_valid_filtered"] = rt_filtered_overall.std()

    # Count of outliers filtered out
    d["n_outliers_rt_overall_valid"] = (
        valid_rt_data.shape[0] - rt_filtered_overall.shape[0]
    )

    # Filtered Response Times by accuracy type (nulls/invalid and outliers removed)
    for metric in ["HIT", "MISS", "FA", "CR"]:
        metric_mask = (x["metric_accuracy"] == metric) & valid_rt_mask
        rt_filtered_signal = x.loc[
            metric_mask
            & (x["response_time_duration_ms"] >= rt_outlier_low)
            & (x["response_time_duration_ms"] <= rt_outlier_high),
            "response_time_duration_ms",
        ]
        d[f"median_rt_{metric}_valid_filtered"] = rt_filtered_signal.median()
        d[f"sd_rt_{metric}_valid_filtered"] = rt_filtered_signal.std()

        # Count of outliers filtered out per accuracy type
        metric_rt_data = x.loc[metric_mask, "response_time_duration_ms"]
        d[f"n_outliers_rt_{metric}_valid"] = (
            metric_rt_data.shape[0] - rt_filtered_signal.shape[0]
        )

    return pd.Series(d)
`;
