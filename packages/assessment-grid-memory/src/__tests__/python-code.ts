export const pythonCode = `
import ast
import json

import numpy as np
import pandas as pd
from scipy.spatial.distance import directed_hausdorff
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

def _deserialize_if_needed(cells):
    """Ensure cell data is a list of dictionaries."""
    if isinstance(cells, str):
        try:
            # Try JSON first
            cells = json.loads(cells)
        except json.JSONDecodeError:
            try:
                # Fallback to Python literal eval
                cells = ast.literal_eval(cells)
            except (ValueError, SyntaxError):
                return []  # Return empty list on failure
    return cells if isinstance(cells, list) else []


def calculate_distance(row, method="hausdorff", aggregate="mean"):
    """
    General-purpose distance calculator between presented and selected cells.

    Args:
        row (pd.Series): A single trial's data.
        method (str): One of ["hausdorff", "error"]
        aggregate (str): Only used for "error" method. One of ["mean", "sum"].

    Returns:
        float or None: The computed distance or None if invalid.
    """
    try:
        presented_cells = _deserialize_if_needed(row["presented_cells"])
        selected_cells = _deserialize_if_needed(row["selected_cells"])

        presented_coords = np.array(
            [[cell["row"], cell["column"]] for cell in presented_cells]
        )
        selected_coords = np.array(
            [[cell["row"], cell["column"]] for cell in selected_cells]
        )

        if presented_coords.size == 0 or selected_coords.size == 0:
            return None

        if method == "hausdorff":
            d1 = directed_hausdorff(presented_coords, selected_coords)[0]
            d2 = directed_hausdorff(selected_coords, presented_coords)[0]
            return max(d1, d2)

        elif method == "error":
            if presented_coords.shape != selected_coords.shape:
                return None
            distances = np.linalg.norm(presented_coords - selected_coords, axis=1)
            return (
                np.mean(distances)
                if aggregate == "mean"
                else np.sum(distances)
                if aggregate == "sum"
                else None
            )

        else:
            raise ValueError(f"Unknown method '{method}'")

    except Exception as e:
        print(f"Error processing row: {e}")
        return None


# Wrapper-Compatible Functions
def score_hausdorff(row):
    return calculate_distance(row, method="hausdorff")


def score_mean_error(row):
    return calculate_distance(row, method="error", aggregate="mean")


def score_sum_error(row):
    return calculate_distance(row, method="error", aggregate="sum")


def summarize(x, trials_expected=4):
    """
    Summarizes grid memory task performance.

    Args:
        x (pd.DataFrame): Trial-level scored dataset.
        trials_expected (int): Expected number of trials.

    Returns:
        pd.Series: Summary statistics.
    """
    # ABSTRACTION TO APPEAR IN EACH SCORING SCRIPT
    d = summarize_common_metadata(x, trials_expected)

    # Error distance summary stats
    for metric in [
        "metric_error_distance_hausdorff",
        "metric_error_distance_mean",
        "metric_error_distance_sum",
    ]:
        d[f"{metric}_mean"] = x[metric].mean()
        d[f"{metric}_median"] = x[metric].median()
        d[f"{metric}_min"] = x[metric].min()
        d[f"{metric}_max"] = x[metric].max()
        d[f"{metric}_sum"] = x[metric].sum()
        d[f"{metric}_std"] = x[metric].std()

    # Return as Series
    return pd.Series(d)

# TODO: need to add count of correct dots per trial.... 
`;
