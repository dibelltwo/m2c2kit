import { filter } from "../ChainBuilder";
import { DataCalc } from "../DataCalc";
import { M2Error } from "../M2Error";
import { Observation } from "../Observation";
import { mean, n, scalar } from "../SummarizeOperations";

describe("lazy callback summarize support", () => {
  it("sees mutated variables when using lazy callbacks", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 0 }, { a: 9 }];

    const dc = new DataCalc(d);
    const res = dc
      .mutate({ doubledA: (obs) => obs.a * 2 })
      .summarize({ meanD: mean((c) => c.pull("doubledA")) });

    expect(res.pull("meanD")).toBeCloseTo((2 + 0 + 18) / 3);
  });

  it("supports arithmetic of scalars and lazy operations", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 0 }, { a: 9 }];

    const dc = new DataCalc(d);
    const res = dc.summarize({ meanAPlus8: scalar(8).add(mean("a")) });

    expect(res.pull("meanAPlus8")).toBeCloseTo((1 + 0 + 9) / 3 + 8);
  });

  it("supports arithmetic of scalars and lazy filter turned into scalar", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 0 }, { a: 9 }];

    const dc = new DataCalc(d);
    const res = dc.summarize({
      filteredALengthPlus3: scalar(filter((obs) => obs.a > 0).length).add(3),
    });

    expect(res.pull("filteredALengthPlus3")).toBe(5);
  });

  it("supports arithmetic of scalars and lazy operation turned into scalar", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 0 }, { a: 9 }];

    const dc = new DataCalc(d);
    const res = dc.summarize({ val: scalar(mean("a")).add(3) });

    expect(res.pull("val")).toBe(10 / 3 + 3);
  });

  it("supports arithmetic of scalars and lazy operation turned into scalar and respects order of operations", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 0 }, { a: 9 }];

    const dc = new DataCalc(d);
    const res = dc.summarize({
      val: scalar(mean("a"))
        .add(3)
        .mul(scalar(mean("a"))),
    });

    expect(res.pull("val")).toBe(10 / 3 + 3 * (10 / 3));
  });

  it("works group-wise with lazy callbacks", () => {
    const d: Array<Observation> = [
      { a: 1, g: "x" },
      { a: 2, g: "y" },
      { a: 3, g: "x" },
      { a: 4, g: "y" },
    ];

    const dc = new DataCalc(d);
    const res = dc
      .mutate({ doubledA: (obs) => obs.a * 2 })
      .groupBy("g")
      .summarize({ meanD: mean((c) => c.pull("doubledA")) });

    // Two groups: x -> a=[1,3] -> doubled [2,6] mean=4 ; y -> a=[2,4] -> doubled [4,8] mean=6
    const obs = res.observations;
    expect(obs).toHaveLength(2);
    expect(obs).toContainEqual({ g: "x", meanD: 4 });
    expect(obs).toContainEqual({ g: "y", meanD: 6 });
  });

  it("n function accepts lazy callbacks", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 0 }, { a: 9 }];

    const dc = new DataCalc(d);
    const res = dc
      .mutate({ doubledA: (obs) => obs.a * 2 })
      .summarize({ n: n((obs: Observation) => obs.a > 2) });

    expect(res.pull("n")).toBe(1);
  });

  it("n function works with empty rows", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 0 }, { a: 9 }];

    const dc = new DataCalc(d);
    const res = dc
      .mutate({ doubledA: (obs) => obs.a * 2 })
      .summarize({ n: n((obs: Observation) => obs.a > 1000) });

    expect(res.pull("n")).toBe(0);
  });
});

describe("lazy callback edge cases", () => {
  it("wraps errors thrown by lazy callbacks with context", () => {
    const d: Array<Observation> = [{ a: 1 }];
    const dc = new DataCalc(d);

    const lazyThrows = () => {
      throw new Error("boom");
    };

    expect(() => dc.summarize({ val: mean((c) => lazyThrows()) })).toThrow(
      /lazy callback threw an error: boom/,
    );
  });

  it("errors when lazy callback returns a DataCalc instance", () => {
    const d: Array<Observation> = [{ a: 1 }];
    const dc = new DataCalc(d);

    const returnsDataCalc = (c: DataCalc) => c;

    expect(() => dc.summarize({ val: mean(returnsDataCalc) })).toThrow(M2Error);
  });
});

describe("lazy repeated calls", () => {
  it("calling summarize multiple times on same DataCalc executes callback once per call", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 2 }];
    const dc = new DataCalc(d).mutate({ doubledA: (obs) => obs.a * 2 });

    let counter = 0;
    const makeSum = () =>
      dc.summarize({
        s: mean((c) => {
          counter++;
          return c.pull("doubledA");
        }),
      });

    const r1 = makeSum();
    const r2 = makeSum();

    // summarize invoked twice (once per call)
    expect(counter).toBe(2);

    expect(r1.pull("s")).toBeCloseTo((2 + 4) / 2);
    expect(r2.pull("s")).toBeCloseTo((2 + 4) / 2);
  });

  it("invokes lazy callback during summarize and not on subsequent pulls", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 2 }, { a: 3 }];

    const dc = new DataCalc(d).mutate({ doubledA: (obs) => obs.a * 2 });

    let counter = 0;
    const res = dc.summarize({
      meanD: mean((c) => {
        counter++;
        return c.pull("doubledA");
      }),
    });

    // Callback should have run once during summarize construction
    expect(counter).toBe(1);

    // Pulling the computed summary should not re-run the callback
    expect(res.pull("meanD")).toBeCloseTo((2 + 4 + 6) / 3);
    expect(counter).toBe(1);

    // Multiple pulls should not increment counter
    expect(res.pull("meanD")).toBeCloseTo((2 + 4 + 6) / 3);
    expect(counter).toBe(1);
  });

  it("invokes lazy callback once per group when grouped", () => {
    const d: Array<Observation> = [
      { a: 1, group: "x" },
      { a: 2, group: "y" },
      { a: 3, group: "x" },
      { a: 4, group: "y" },
    ];

    const dc = new DataCalc(d).mutate({ doubledA: (obs) => obs.a * 2 });

    let counter = 0;
    const res = dc.groupBy("group").summarize({
      meanD: mean((c) => {
        counter++;
        return c.pull("doubledA");
      }),
    });

    // Two groups: callback should have been invoked once per group
    expect(counter).toBe(2);

    const obs = res.observations;
    expect(obs).toHaveLength(2);
  });
});
