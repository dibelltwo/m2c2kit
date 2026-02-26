import { DataCalc } from "../DataCalc";
import { Observation } from "../Observation";

describe("DataCalc constructor tests", () => {
  let validData: Array<Observation>;

  beforeEach(() => {
    validData = [
      { a: 1, b: 2, c: 3 },
      { a: 0, b: 8, c: 3 },
      { a: 9, b: 4, c: 7 },
      { a: 5, b: 0, c: 7 },
    ];
  });

  it("creates a DataCalc instance with valid data", () => {
    const dc = new DataCalc(validData);
    expect(dc).toBeInstanceOf(DataCalc);
    expect(dc.observations).toEqual(validData);
    expect(dc.length).toBe(4);
  });

  it("normalizes observations by filling missing variables with null", () => {
    // Constructor should ensure all observations have the same shape
    const sparseData = [{ a: 1 }, { b: 2 }];
    const dc = new DataCalc(sparseData);
    expect(dc.observations).toEqual([
      { a: 1, b: null },
      { a: null, b: 2 },
    ]);
  });

  it("throws an error when data is not an array", () => {
    // @ts-expect-error Testing invalid input
    expect(() => new DataCalc("not an array")).toThrow(
      "DataCalc constructor expects an array of observations as first argument",
    );

    // @ts-expect-error Testing invalid input
    expect(() => new DataCalc({})).toThrow(
      "DataCalc constructor expects an array of observations as first argument",
    );

    // @ts-expect-error Testing invalid input
    expect(() => new DataCalc(null)).toThrow(
      "DataCalc constructor expects an array of observations as first argument",
    );
  });

  it("throws an error when array contains null", () => {
    const invalidData = [{ a: 1 }, null, { c: 3 }];
    // @ts-expect-error Testing invalid input
    expect(() => new DataCalc(invalidData)).toThrow(
      "DataCalc constructor expects all elements to be objects (observations)",
    );
  });

  it("throws an error when array contains a primitive value", () => {
    const invalidData = [{ a: 1 }, 123, { c: 3 }];
    // @ts-expect-error Testing invalid input
    expect(() => new DataCalc(invalidData)).toThrow(
      "DataCalc constructor expects all elements to be objects (observations)",
    );
  });

  it("throws an error when array contains an array instead of an object", () => {
    const invalidData = [{ a: 1 }, [1, 2, 3], { c: 3 }];
    expect(() => new DataCalc(invalidData)).toThrow(
      "DataCalc constructor expects all elements to be objects (observations)",
    );
  });

  it.each([
    [
      "string",
      "not an array",
      "DataCalc constructor expects an array of observations as first argument",
    ],
    [
      "number",
      123,
      "DataCalc constructor expects an array of observations as first argument",
    ],
    [
      "null",
      null,
      "DataCalc constructor expects an array of observations as first argument",
    ],
    [
      "undefined",
      undefined,
      "DataCalc constructor expects an array of observations as first argument",
    ],
    [
      "array element null",
      [{ a: 1 }, null, { c: 3 }],
      "DataCalc constructor expects all elements to be objects (observations)",
    ],
    [
      "array element primitive",
      [{ a: 1 }, 123, { c: 3 }],
      "DataCalc constructor expects all elements to be objects (observations)",
    ],
    [
      "array element array",
      [{ a: 1 }, [1, 2, 3], { c: 3 }],
      "DataCalc constructor expects all elements to be objects (observations)",
    ],
  ])(
    "constructor invalid input %s throws expected message",
    (_label, input, expected) => {
      expect(() => new DataCalc(input as any)).toThrow(expected);
    },
  );

  it("creates a deep copy of the data (modifications to original don't affect instance)", () => {
    const dc = new DataCalc(validData);

    // Modify the original data
    validData[0].a = 999;
    validData.push({ a: 100, b: 200, c: 300 });

    // Verify the DataCalc instance wasn't affected
    expect(dc.observations[0].a).toBe(1);
    expect(dc.length).toBe(4);
  });

  it("handles circular references in constructor deep copy", () => {
    const obj: Observation = { a: 1 };
    obj.self = obj;
    const data = [obj];

    const dc = new DataCalc(data);
    expect(dc.observations[0].a).toBe(1);
    // The copy should preserve the circular structure
    expect(dc.observations[0].self).toBe(dc.observations[0]);

    // Verify independence from original
    obj.a = 2;
    expect(dc.observations[0].a).toBe(1);
  });

  it("snapshots getters as values in constructor deep copy", () => {
    const obj: Observation = {
      _val: 1,
      get val() {
        return this._val;
      },
    };
    const data = [obj];

    const dc = new DataCalc(data);
    expect(dc.observations[0].val).toBe(1);

    // Verify independence from source
    obj._val = 2;
    expect(dc.observations[0].val).toBe(1);
  });

  it("sets up groups from options", () => {
    const dc = new DataCalc(validData, { groups: ["c"] });
    expect(dc.groups).toEqual(["c"]);
  });

  it("creates an instance with empty data array", () => {
    const dc = new DataCalc([]);
    expect(dc).toBeInstanceOf(DataCalc);
    expect(dc.observations).toEqual([]);
    expect(dc.length).toBe(0);
  });
});
