import { DataCalc } from "./DataCalc";
import { DataValue } from "./DataValue";
import { SummarizeOptions } from "./SummarizeOptions";

/**
 * A lazy value callback evaluated at summarize-time. Receives the current
 * (possibly group-scoped) `DataCalc` and should return a `DataValue` or an
 * array of `DataValue`s.
 */
export type LazyValue = (dataCalc: DataCalc) => DataValue | DataValue[];

/**
 * A function that internally executes the summarize operation.
 */
export type SummarizeFunction = (
  /** The DataCalc instance to use for the operation */
  dataCalc: DataCalc,
  /** The parameters to use for the operation */
  params?: Array<DataValue | LazyValue> | undefined,
  /** The options to use for the operation */
  options?: SummarizeOptions,
) => DataValue;
