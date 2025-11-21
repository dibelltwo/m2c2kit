import { DataCalc } from "./DataCalc";
import { DataValue } from "./DataValue";
import { SummarizeOptions } from "./SummarizeOptions";

/**
 * A function that internally executes the summarize operation.
 */
export type SummarizeFunction = (
  /** The DataCalc instance to use for the operation */
  dataCalc: DataCalc,
  /** The parameters to use for the operation */
  params?: Array<DataValue> | undefined,
  /** The options to use for the operation */
  options?: SummarizeOptions,
) => DataValue;
