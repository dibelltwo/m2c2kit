import Ajv from "ajv";
import addFormats from "ajv-formats";

export interface ValidationOptions {
  /** Summary from the JavaScript code */
  jsSummary: { [key: string]: any };
  /** JSON schema to validate against */
  schema: { [key: string]: any } | undefined;
}

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  verbose: true,
  removeAdditional: false, // don't silently drop extra props
  coerceTypes: false,
  useDefaults: false,
});
addFormats(ajv);

/**
 * Validates a JavaScript summary object against a JSON schema
 *
 * @param options - validation options including the summary and schema
 */
export const validateJsAgainstSchema = (options: ValidationOptions) => {
  expect(options.schema).toBeDefined();

  const wrapperSchema = {
    type: "object",
    properties: options.schema,
    additionalProperties: false,
  };

  // Ensure the schema itself is valid
  expect(ajv.validateSchema(wrapperSchema)).toBe(true);

  const validate = ajv.compile(wrapperSchema);
  const valid = validate(options.jsSummary);

  if (!valid) {
    console.error("Schema validation errors:", validate.errors);
  }
  expect(valid).toBe(true);
};

export interface ComparisonOptions {
  /** Summary from the JavaScript code */
  jsSummary: { [key: string]: any };
  /** Summary from the Python code */
  pySummary: { [key: string]: any };
  /** Optional list of keys to ignore in the value comparisons */
  ignoreKeys?: string[];
  /** Optional list of substrings; any key containing one of these will be ignored in the value comparisons */
  ignoreKeysContaining?: string[];
  coercePythonBooleanToNumber?: boolean;
  /** If true, print verbose output */
  verbose?: boolean;
  /** Precision for numeric comparison (default: 2) */
  precision?: number;
}

/**
 * Compares summary objects from JavaScript and Python
 *
 * @remarks It handles numeric precision issues and treats NaN/null as
 * equivalent "missing" values. Can specify keys to ignore or substrings
 * to ignore in keys.
 *
 * @param options - comparison options including the summaries, ignore lists,
 * precision, boolean coercion, and verbose output.
 */
export const jsPyCompareSummaries = (options: ComparisonOptions) => {
  const ignoreExact = options?.ignoreKeys ?? [];
  const ignoreContain = options?.ignoreKeysContaining ?? [];
  const precision = options.precision ?? 2;

  const shouldKeepKey = (k: string) => {
    if (ignoreExact.includes(k)) return false;
    if (ignoreContain.some((sub) => k.includes(sub))) return false;
    return true;
  };

  const pyKeys = Object.keys(options.pySummary).filter(shouldKeepKey);
  const jsKeys = Object.keys(options.jsSummary).filter(shouldKeepKey);

  const commonKeys = pyKeys.filter((k) => jsKeys.includes(k));

  const mismatches: Array<{
    key: string;
    py: any;
    js: any;
    message?: string;
  }> = [];

  commonKeys.forEach((key) => {
    const pyVal = (options.pySummary as any)[key];
    const jsVal = (options.jsSummary as any)[key];

    try {
      const isPyNum = typeof pyVal === "number" && !isNaN(pyVal);
      const isJsNum = typeof jsVal === "number" && !isNaN(jsVal);

      if (isPyNum && isJsNum) {
        // Both are valid numbers: check precision
        expect(jsVal).toBeCloseTo(pyVal, precision);
      } else if (Number.isNaN(pyVal) || Number.isNaN(jsVal)) {
        // One or both are NaN: in data science, NaN is usually the equivalent of "missing"
        // We check if BOTH are NaN-ish (either NaN or null)
        const pyMissing = pyVal === null || Number.isNaN(pyVal);
        const jsMissing = jsVal === null || Number.isNaN(jsVal);

        if (!(pyMissing && jsMissing)) {
          throw new Error(
            `Value mismatch: python=${pyVal}, javascript=${jsVal}`,
          );
        }
      } else if (
        typeof pyVal === "boolean" &&
        typeof jsVal === "number" &&
        options.coercePythonBooleanToNumber
      ) {
        // Coerce Python booleans to numbers (True -> 1, False -> 0) before comparison
        const coercedPyVal = pyVal ? 1 : 0;
        console.warn(
          `Key ${key}: coercing Python boolean ${pyVal} to number ${coercedPyVal} for comparison`,
        );
        expect(jsVal).toBeCloseTo(coercedPyVal);
      } else {
        // Handle standard null === null or string === string
        expect(jsVal).toEqual(pyVal);
      }
    } catch (e) {
      mismatches.push({
        key,
        py: pyVal,
        js: jsVal,
        message: (e as Error).message,
      });
    }
  });

  if (options.verbose) {
    console.log("JavaScript:", options.jsSummary);
    console.log("Python:", options.pySummary);
  }

  if (mismatches.length > 0) {
    mismatches.forEach((m) => {
      try {
        console.error(
          `Mismatch on key ${m.key}: python=${JSON.stringify(m.py)} javascript=${JSON.stringify(m.js)}\n`,
        );
      } catch (e) {
        console.error(`Error stringifying mismatch on key ${m.key}: ${e}\n`);
        console.error(
          `Mismatch on key ${m.key}: python=${String(m.py)} javascript=${String(m.js)}\n`,
        );
      }
    });
    expect(mismatches.length).toBe(0);
  } else {
    console.log(
      `All ${commonKeys.length} common keys matched between Python and JavaScript results.`,
    );
  }

  const allPyKeys = Object.keys(options.pySummary);
  const allJsKeys = Object.keys(options.jsSummary);

  const pyOnly = allPyKeys.filter((k) => !allJsKeys.includes(k));
  const jsOnly = allJsKeys.filter((k) => !allPyKeys.includes(k));

  let nonSharedKeysWarning = "";
  if (pyOnly.length > 0) {
    nonSharedKeysWarning += `Keys only in Python: ${pyOnly.join(", ")}.\n`;
  }
  if (jsOnly.length > 0) {
    nonSharedKeysWarning += `Keys only in JavaScript: ${jsOnly.join(", ")}.\n`;
  }
  if (nonSharedKeysWarning.length > 0) {
    console.warn(nonSharedKeysWarning);
  }
};
