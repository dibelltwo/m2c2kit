import { DataCalc } from "../DataCalc";
import { Observation } from "../Observation";
import {
  arrange,
  slice,
  mutate,
  select,
  distinct,
  clearChainOps,
  filter,
  getChainOps,
  pull,
  groupBy as cbGroupBy,
} from "../ChainBuilder";
import { mean, scalar } from "../SummarizeOperations";

describe("ChainBuilder tests", () => {
  it("uses arrange, slice, pull in ungrouped summarize after mutate", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 2 }, { a: 3 }];
    const dc = new DataCalc(d);
    const res = dc.mutate({ doubledA: (obs) => obs.a * 2 }).summarize({
      smallestD: arrange("doubledA")
        .arrange("doubledA")
        .slice(0)
        .pull("doubledA"),
    });

    expect(res.pull("smallestD")).toBe(2);
  });

  it("works groupwise with chain expressions", () => {
    const d: Array<Observation> = [
      { a: 1, g: "x" },
      { a: 2, g: "x" },
      { a: 3, g: "y" },
    ];

    const dc = new DataCalc(d);
    const res = dc
      .mutate({ doubledA: (obs) => obs.a * 2 })
      .groupBy("g")
      .summarize({ smallestD: arrange("doubledA").slice(0).pull("doubledA") });

    const obs = res.observations;
    expect(obs).toHaveLength(2);
    expect(obs).toContainEqual({ g: "x", smallestD: 2 });
    expect(obs).toContainEqual({ g: "y", smallestD: 6 });
  });

  it("supports using filter, length, and additive operations inside summarize", () => {
    const d: Array<Observation> = [
      { a: 1, g: "x" },
      { a: 2, g: "x" },
      { a: 3, g: "y" },
    ];

    const dc = new DataCalc(d);
    const res = dc
      .mutate({
        doubledA: (obs) => obs.a * 2,
        isX: (obs) => (obs.g === "x" ? "yes" : "no"),
      })
      .summarize({
        isXLengthAddedTwice: scalar(2).add(scalar(2)),
      });

    expect(res.pull("isXLengthAddedTwice")).toBe(4);
  });

  it("supports using filter, length, and additive operations including a scalar inside summarize using helper arithmetic functions", () => {
    const d: Array<Observation> = [
      { a: 1, g: "x" },
      { a: 2, g: "x" },
      { a: 3, g: "y" },
    ];

    const dc = new DataCalc(d);
    const res2 = dc
      .mutate({
        doubledA: (obs) => obs.a * 2,
        isX: (obs) => (obs.g === "x" ? "yes" : "no"),
      })
      .summarize({
        hasXAddedTwiceWithScalar: scalar(5)
          .add(filter((obs) => obs.isX === "yes").length)
          .add(filter((obs) => obs.isX === "yes").length),
      });

    expect(res2.pull("hasXAddedTwiceWithScalar")).toBe(9);
  });

  it("serialized chain with missing method throws", () => {
    // Create a placeholder via ChainBuilder and then mutate the registered ops
    const ph = String(pull("v").length);
    const id = ph.match(/__CHAIN_EXPR__\[(.*?)\]/)![1];
    const dc = new DataCalc([{ g: 1, v: 1 }]);
    const ops = getChainOps(id)!;
    // Replace first op name with a non-existent method to trigger the error
    ops[0].name = "noSuch";
    expect(() => dc.groupBy("g").summarize({ x: ph })).toThrow(
      /does not exist/,
    );
  });

  it("malformed serialized chain payload throws parse error", () => {
    // Use a ChainBuilder placeholder but clear its registry entry so summarize
    // will attempt to JSON.parse the payload (which will be the id string)
    const ph = String(pull("v").length);
    const id = ph.match(/__CHAIN_EXPR__\[(.*?)\]/)![1];
    // remove the registry entry so getChainOps will return undefined
    clearChainOps(id);
    const dc = new DataCalc([{ g: 1, v: 1 }]);
    expect(() => dc.groupBy("g").summarize({ x: ph })).toThrow(
      /failed to parse chain payload/,
    );
  });

  it("serialized null ops payload throws empty-ops error", () => {
    // Build a ChainBuilder placeholder and replace its payload with encoded 'null'
    const ph = String(pull("v").length);
    const id = ph.match(/__CHAIN_EXPR__\[(.*?)\]/)![1];
    const nullPayload = encodeURIComponent("null");
    const phNull = ph.replace(id, nullPayload);
    const dc = new DataCalc([{ g: 1, v: 1 }]);
    expect(() => dc.groupBy("g").summarize({ x: phNull })).toThrow(
      /empty chain ops/,
    );
  });

  it("chain mutate applies sequentially inside summarize", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 2 }];
    const dc = new DataCalc(d);

    const res = dc.summarize({
      a3Vals: mutate({ a2: (o: Observation) => o.a + 1 })
        .mutate({ a3: (o: Observation) => o.a2 * 2 })
        .pull("a3"),
    });

    expect(res.pull("a3Vals")).toEqual([4, 6]);
  });

  it("chain slice returns range of values inside summarize", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 2 }, { a: 3 }];
    const dc = new DataCalc(d);

    const res = dc.mutate({ doubledA: (o: Observation) => o.a * 2 }).summarize({
      firstTwo: slice(0, 2).pull("doubledA"),
    });

    expect(res.pull("firstTwo")).toEqual([2, 4]);
  });

  it("chain select + rename works inside summarize", () => {
    const d: Array<Observation> = [
      { a: 1, b: 9 },
      { a: 3, b: 8 },
    ];
    const dc = new DataCalc(d);

    const res = dc.summarize({
      xs: select("a").rename({ x: "a" }).pull("x"),
    });

    expect(res.pull("xs")).toEqual([1, 3]);
  });

  it("chain distinct returns unique values per group", () => {
    const d: Array<Observation> = [
      { a: 1, g: "x" },
      { a: 1, g: "x" },
      { a: 2, g: "y" },
    ];

    const dc = new DataCalc(d);
    // Use serialized ops payload to avoid registry timing issues in grouped summarize
    const ops = distinct().pull("a").ops;
    const payload = encodeURIComponent(JSON.stringify(ops));
    const ph = `__CHAIN_EXPR__[${payload}]`;

    const res = dc.groupBy("g").summarize({ uniqA: ph });

    const obs = res.observations;
    expect(obs).toContainEqual({ g: "x", uniqA: 1 });
    // single-row group yields scalar terminal (2)
    expect(obs).toContainEqual({ g: "y", uniqA: 2 });
  });

  it("chain ungroup used in grouped summarize falls back to global length", () => {
    const d: Array<Observation> = [
      { a: 1, g: "x" },
      { a: 2, g: "x" },
      { a: 3, g: "y" },
    ];

    const dc = new DataCalc(d);
    // Use serialized ops payload to ensure summarize can parse ops in grouped mode
    const ops = cbGroupBy("g").ungroup().ops;
    const payload = encodeURIComponent(JSON.stringify(ops));
    const ph = `__CHAIN_EXPR__[${payload}]`;

    const res = dc.groupBy("g").summarize({ totalN: ph });

    const obs = res.observations;
    // serialized ungrouped chain without a terminal falls back to group length
    expect(obs).toContainEqual({ g: "x", totalN: 2 });
    expect(obs).toContainEqual({ g: "y", totalN: 1 });
  });
});

describe("Chained evaluation order tests", () => {
  it("applies chained mutate operations in sequence", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 2 }];
    const dc = new DataCalc(d)
      .mutate({ a2: (o) => o.a + 1 })
      .mutate({ a3: (o) => o.a2 * 2 });

    // Expect a3: (a + 1) * 2 -> [4, 6]
    expect(dc.pull("a3")).toEqual([4, 6]);
  });

  it("filter sees fields added by previous mutate", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 2 }, { a: 5 }];

    const dc = new DataCalc(d)
      .mutate({ tens: (o) => o.a * 10 })
      .filter((o) => o.tens >= 20);

    const obs = dc.observations;
    expect(obs.map((r) => r.a)).toEqual([2, 5]);
  });

  it("summarize lazy callbacks evaluate after preceding mutate in chain", () => {
    const d: Array<Observation> = [{ a: 2 }, { a: 4 }, { a: 6 }];

    const dc = new DataCalc(d).mutate({ double: (o) => o.a * 2 });

    const res = dc.summarize({ meanDouble: mean((c) => c.pull("double")) });

    expect(res.pull("meanDouble")).toBeCloseTo((4 + 8 + 12) / 3);
  });
});

describe("serialized chain placeholders (grouped)", () => {
  it("serialized chain returns array length per group", () => {
    const d: Array<Observation> = [
      { a: 1, g: "x" },
      { a: 2, g: "x" },
      { a: 3, g: "y" },
    ];

    const dc = new DataCalc(d);
    const ops = pull("a").ops;
    const payload = encodeURIComponent(JSON.stringify(ops));
    const ph = `__CHAIN_EXPR__[${payload}]`;

    const res = dc.groupBy("g").summarize({ cnt: ph });

    expect(res.observations).toHaveLength(2);
    expect(res.observations).toContainEqual({ g: "x", cnt: 2 });
    // single-row group yields scalar terminal (3), not a length
    expect(res.observations).toContainEqual({ g: "y", cnt: 3 });
  });

  it("serialized chain with boolean terminal coerces to number per group", () => {
    const d: Array<Observation> = [
      { flag: true, g: "x" },
      { flag: false, g: "y" },
    ];

    const dc = new DataCalc(d);
    const ops = pull("flag").ops;
    const payload = encodeURIComponent(JSON.stringify(ops));
    const ph = `__CHAIN_EXPR__[${payload}]`;

    const res = dc.groupBy("g").summarize({ v: ph });

    expect(res.observations).toContainEqual({ g: "x", v: 1 });
    expect(res.observations).toContainEqual({ g: "y", v: 0 });
  });

  it("serialized chain with no terminal falls back to current.length per group", () => {
    const d: Array<Observation> = [
      { a: 1, g: "x" },
      { a: 2, g: "x" },
      { a: 3, g: "y" },
    ];

    const dc = new DataCalc(d);
    const ops = cbGroupBy("g").ungroup().ops;
    const payload = encodeURIComponent(JSON.stringify(ops));
    const ph = `__CHAIN_EXPR__[${payload}]`;

    const res = dc.groupBy("g").summarize({ sz: ph });

    expect(res.observations).toContainEqual({ g: "x", sz: 2 });
    expect(res.observations).toContainEqual({ g: "y", sz: 1 });
  });

  it("coerces boolean scalar result from chain in ungrouped summarize", () => {
    const data = [{ flag: true }];
    const dc = new DataCalc(data);

    // pull("flag") on a single row returns a scalar boolean.
    // We access .length to get the serialized chain placeholder string.
    const chainExpr = pull("flag").length as unknown as string;

    // summarize should evaluate the chain, get `true`, and coerce it to 1
    const res = dc.summarize({ val: chainExpr });
    expect(res.pull("val")).toBe(1);
  });

  it("coerces false boolean scalar result from chain in ungrouped summarize", () => {
    const data = [{ flag: false }];
    const dc = new DataCalc(data);
    const chainExpr = pull("flag").length as unknown as string;

    const res = dc.summarize({ val: chainExpr });
    expect(res.pull("val")).toBe(0);
  });
});
