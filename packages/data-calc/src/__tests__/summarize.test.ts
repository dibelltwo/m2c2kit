import { DataCalc } from "../DataCalc";
import { Observation } from "../Observation";
import {
  mean,
  sum,
  median,
  variance,
  max,
  min,
  sd,
  n,
  parens,
  scalar,
  s,
} from "../SummarizeOperations";

let d: Array<Observation>;
let d_empty: Array<Observation>;
let d_multi: Array<Observation>;

describe("summarize tests", () => {
  beforeEach(() => {
    d = [
      { a: 1, b: 2, c: 3 },
      { a: 0, b: 8, c: 3 },
      { a: 9, b: 4, c: 7 },
      { a: 5, b: 0, c: 7 },
    ];

    d_empty = [];

    d_multi = [
      { a: 1, b: 3, c: 1 },
      { a: 1, b: 2, c: 2 },
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 3, c: 1 },
      { a: 4, b: 2, c: 5 },
      { a: 4, b: 2, c: 1 },
      { a: 4, b: 3, c: 10 },
      { a: 4, b: 3, c: 12 },
    ];
  });

  it("calculates a single summary statistic", () => {
    const dc = new DataCalc(d);
    const result = dc.summarize({
      meanA: mean("a"),
    });
    expect(result.observations).toEqual([{ meanA: 3.75 }]);
  });

  it("calculates multiple summary statistics", () => {
    const dc = new DataCalc(d);
    const result = dc.summarize({
      meanA: mean("a"),
      sumB: sum("b"),
      medianC: median("c"),
    });
    expect(result.observations).toEqual([
      { meanA: 3.75, sumB: 14, medianC: 5 },
    ]);
  });

  it("returns a new DataCalc object", () => {
    const dc = new DataCalc(d);
    const result = dc.summarize({ meanA: mean("a") });
    expect(result).toBeInstanceOf(DataCalc);
    expect(result).not.toBe(dc);
    // Original should be unchanged
    expect(dc.observations).toEqual(d);
  });

  it("returns a single observation for ungrouped data", () => {
    const dc = new DataCalc(d);
    const result = dc.summarize({
      meanA: mean("a"),
      varA: variance("a"),
    });
    expect(result.observations.length).toBe(1);
  });

  it("calculates summaries for grouped data", () => {
    const dc = new DataCalc(d);
    const grouped = dc.groupBy("c");
    const result = grouped.summarize({
      meanA: mean("a"),
      sumB: sum("b"),
    });

    expect(result.observations).toEqual([
      { c: 3, meanA: 0.5, sumB: 10 }, // Group c=3: a=[1,0], b=[2,8]
      { c: 7, meanA: 7, sumB: 4 }, // Group c=7: a=[9,5], b=[4,0]
    ]);
  });

  it("calculates summaries for multi-level grouped data", () => {
    const dc = new DataCalc(d_multi);
    const result = dc.groupBy("a", "b").summarize({
      meanC: mean("c"),
      sumC: sum("c"),
    });

    expect(result.observations).toHaveLength(4);
    expect(result.observations).toContainEqual({
      a: 1,
      b: 2,
      meanC: 2.5,
      sumC: 5,
    });
    expect(result.observations).toContainEqual({
      a: 1,
      b: 3,
      meanC: 1,
      sumC: 2,
    });
    expect(result.observations).toContainEqual({
      a: 4,
      b: 2,
      meanC: 3,
      sumC: 6,
    });
    expect(result.observations).toContainEqual({
      a: 4,
      b: 3,
      meanC: 11,
      sumC: 22,
    });
  });

  it("handles specific multi-level grouping example from prompt", () => {
    const dc = new DataCalc(d_multi);
    const result = dc.groupBy("a").summarize({
      meanC: mean("c"),
    });

    expect(result.observations).toHaveLength(2);
    expect(result.observations).toContainEqual({ a: 1, meanC: 1.75 }); // Mean of [1,2,3,1]
    expect(result.observations).toContainEqual({ a: 4, meanC: 7 }); // Mean of [5,1,10,12]
  });

  it("preserves group variables in the output", () => {
    const dc = new DataCalc(d);
    const result = dc.groupBy("c").summarize({ meanA: mean("a") });

    expect(result.observations[0]).toHaveProperty("c");
    expect(result.observations[1]).toHaveProperty("c");
  });

  it("throws when grouping by non-primitive values", () => {
    const bad = [{ a: { x: 1 }, b: 2 }];
    const dc = new DataCalc(bad);
    expect(() => dc.groupBy("a")).toThrow();
  });

  it("groups null values together and preserves null in summary", () => {
    const dNull = [
      { g: null, val: 1 },
      { g: null, val: 2 },
      { g: "x", val: 3 },
    ];
    const dc = new DataCalc(dNull);
    const res = dc.groupBy("g").summarize({ sumVal: sum("val") });

    expect(res.observations).toHaveLength(2);
    expect(res.observations).toContainEqual({ g: null, sumVal: 3 });
    expect(res.observations).toContainEqual({ g: "x", sumVal: 3 });
  });

  it("grouped lazy callback returning a function throws", () => {
    const data = [
      { g: 1, v: 1 },
      { g: 1, v: 2 },
    ];
    const dc = new DataCalc(data);
    expect(() => dc.groupBy("g").summarize({ bad: () => () => {} })).toThrow();
  });

  it("grouped lazy callback returning a DataCalc throws", () => {
    const data = [
      { g: 1, v: 1 },
      { g: 2, v: 2 },
    ];
    const dc = new DataCalc(data);
    expect(() =>
      dc.groupBy("g").summarize({ bad: () => new DataCalc([]) }),
    ).toThrow();
  });

  it("grouped lazy callback that throws is wrapped in an M2Error", () => {
    const data = [{ g: 1, v: 1 }];
    const dc = new DataCalc(data);
    expect(() =>
      dc.groupBy("g").summarize({
        bad: () => {
          throw new Error("boom");
        },
      }),
    ).toThrow(/threw an error/);
  });

  it("handles empty datasets", () => {
    const dc = new DataCalc(d_empty);
    const result = dc.summarize({ count: n() });

    expect(result.observations).toEqual([{ count: 0 }]);
  });

  it("returns null for invalid variable name used in summarize operation", () => {
    const dc = new DataCalc(d);
    expect(dc.summarize({ meanX: mean("x") }).pull("meanX")).toBeNull();
  });

  it("handles all summary operation types", () => {
    const dc = new DataCalc(d);
    const result = dc.summarize({
      meanA: mean("a"),
      sumB: sum("b"),
      medianC: median("c"),
      varA: variance("a"),
      minA: min("a"),
      maxA: max("a"),
      sdA: sd("a"),
      count: n(),
    });

    expect(result.observations[0]).toHaveProperty("meanA");
    expect(result.observations[0]).toHaveProperty("sumB");
    expect(result.observations[0]).toHaveProperty("medianC");
    expect(result.observations[0]).toHaveProperty("varA");
    expect(result.observations[0]).toHaveProperty("minA");
    expect(result.observations[0]).toHaveProperty("maxA");
    expect(result.observations[0]).toHaveProperty("sdA");
    expect(result.observations[0]).toHaveProperty("count");
  });

  it("supports chaining operations on summarized data", () => {
    const dc = new DataCalc(d_multi);
    const result = dc
      .groupBy("a", "b")
      .summarize({ meanC: mean("c") })
      .ungroup()
      .summarize({ overallMean: mean("meanC") });

    expect(result.observations).toEqual([{ overallMean: 4.375 }]); // Mean of [2.5, 1, 3, 11]
  });
});

describe("Summarize expression precedence and parens()", () => {
  test("multiplication has higher precedence than addition in chained expressions", () => {
    const d = [{ a: 1 }, { a: 5 }, { a: 4 }]; // mean = 10/3 ≈ 3.3333333
    const dc = new DataCalc(d);

    const result = dc.summarize({
      // mean + (5 * 10) => ≈ 3.3333 + 50 = 53.3333...
      val: mean("a").add(5).mul(10),
    });

    expect(result.pull("val")).toBeCloseTo(53.3333333333, 8);
  });

  test("parens() forces explicit grouping", () => {
    const d = [{ a: 1 }, { a: 5 }, { a: 4 }]; // mean ≈ 3.3333
    const dc = new DataCalc(d);

    const result = dc.summarize({
      // (mean + 5) * 10 => (3.3333 + 5) * 10 = 83.3333...
      val: parens(mean("a").add(5)).mul(10),
    });

    expect(result.pull("val")).toBeCloseTo(83.3333333333, 8);
  });

  test("two summary operations", () => {
    const d = [
      { a: 1, b: 0 },
      { a: 5, b: 2 },
      { a: 4, b: 3 },
    ];
    // mean a = 10/3 ≈ 3.3333333
    // mean b = 5/3 ≈ 1.6666667
    const dc = new DataCalc(d);

    const result = dc.summarize({
      // mean a + mean b = 5
      val: mean("a").add(mean("b")),
    });

    expect(result.pull("val")).toBeCloseTo(5);
  });

  test("two summary operations and operator precedence", () => {
    const d = [
      { a: 1, b: 0 },
      { a: 5, b: 2 },
      { a: 4, b: 3 },
    ];
    // mean a = 10/3 ≈ 3.3333333
    // mean b = 5/3 ≈ 1.6666667
    const dc = new DataCalc(d);

    const result = dc.summarize({
      // mean a + mean b * 10 = 20
      val: mean("a").add(mean("b")).mul(10),
    });

    expect(result.pull("val")).toBeCloseTo(20);
  });

  test("two different summary operations and parentheses", () => {
    const d = [
      { a: 1, b: 0 },
      { a: 5, b: 2 },
      { a: 4, b: 3 },
    ];
    // mean a = 10/3 ≈ 3.3333333
    // min b = 0
    const dc = new DataCalc(d);

    const result = dc.summarize({
      // (mean a + min b) * 10 = 33.3333...
      val: parens(mean("a").add(min("b"))).mul(10),
    });

    expect(result.pull("val")).toBeCloseTo(33.333);
  });

  test("complex precedence example", () => {
    const dc = new DataCalc([{ a: 1 }, { a: 2 }]); // mean = 1.5
    // mean + 2 * scalar(3) ^ 2 => 1.5 + 2*(9) = 19.5
    const expr = mean("a").add(scalar(2).mul(scalar(3).pow(2)));
    expect(dc.summarize({ val: expr }).pull("val")).toBeCloseTo(19.5);
  });

  test("divide by zero returns null", () => {
    const d = [
      { a: 1, b: 0 },
      { a: 5, b: 2 },
      { a: 4, b: 3 },
    ];
    const dc = new DataCalc(d);

    const result = dc.summarize({
      val: mean("a").div(0),
    });

    expect(result.pull("val")).toBeNull();
  });

  test("pow is right-associative", () => {
    const dc = new DataCalc([{}]);

    // 2^(3^2) = 2^9 = 512; ensure pow is right-associative
    const result = dc.summarize({ val: scalar(2).pow(3).pow(2) });

    expect(result.pull("val")).toBeCloseTo(512);
  });

  test("expression NaN -> null", () => {
    const d = [{ a: 1 }, { a: 2 }];
    const dc = new DataCalc(d);

    // add a NaN literal into the expression; final result should be normalized to null
    const result = dc.summarize({ val: mean("a").add(scalar(NaN)) });

    expect(result.pull("val")).toBeNull();
  });

  test("mid-expression NaN propagates to null final", () => {
    const dc = new DataCalc([
      { a: 1, b: 0 },
      { a: 2, b: 0 },
    ]);
    const expr = mean("a").sub(mean("a")).div(mean("b")).mul(scalar(5));

    expect(dc.summarize({ val: expr }).pull("val")).toBeNull();
  });
});

describe("scalar helper scalar()/s()", () => {
  test("scalar first: scalar(10).mul(mean('a'))", () => {
    const d = [{ a: 1 }, { a: 5 }, { a: 4 }]; // mean = 10/3
    const dc = new DataCalc(d);

    const result = dc.summarize({ val: scalar(10).mul(mean("a")) });
    // expect 10 * mean = 10 * 10/3 = 100/3 ≈ 33.3333
    expect(result.pull("val")).toBeCloseTo(100 / 3, 8);
  });

  test("scalar second: mean('a').mul(scalar(10))", () => {
    const d = [{ a: 1 }, { a: 5 }, { a: 4 }];
    const dc = new DataCalc(d);

    const result = dc.summarize({ val: mean("a").mul(scalar(10)) });
    expect(result.pull("val")).toBeCloseTo(100 / 3, 8);
  });

  test("alias s() works like scalar()", () => {
    const d = [{ a: 2 }, { a: 4 }]; // mean = 3
    const dc = new DataCalc(d);

    const result = dc.summarize({ val: s(5).mul(mean("a")) });
    // 5 * 3 = 15
    expect(result.pull("val")).toBeCloseTo(15);
  });

  test("boolean coercion: scalar(true) coerces to 1 by default", () => {
    const d = [{ a: 1 }, { a: 2 }];
    const dc = new DataCalc(d);

    const result = dc.summarize({ val: scalar(true).mul(mean("a")) });
    // mean = 1.5, 1 * 1.5 = 1.5
    expect(result.pull("val")).toBeCloseTo(1.5);
  });

  test("boolean coercion: scalar(true) throws if coerceBooleans is false", () => {
    const d = [{ a: 1 }, { a: 2 }];
    const dc = new DataCalc(d);

    // SummarizeOperation stores options on the operation; DataCalc.summarize passes them through
    const op = scalar(true);
    op.options = { coerceBooleans: false };

    expect(() => dc.summarize({ val: op })).toThrow();
  });

  test("scalar(null) yields null", () => {
    const d = [{ a: 1 }];
    const dc = new DataCalc(d);

    const result = dc.summarize({ val: scalar(null).mul(mean("a")) });
    expect(result.pull("val")).toBeNull();
  });

  test("scalar with numeric string throws", () => {
    const dc = new DataCalc([{ a: 1 }]);
    // @ts-expect-error: testing runtime behavior with incorrect type
    expect(() => dc.summarize({ val: scalar("3") })).toThrow();
  });
});
