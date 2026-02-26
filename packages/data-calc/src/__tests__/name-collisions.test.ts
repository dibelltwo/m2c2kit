import { DataCalc } from "../DataCalc";
import { Observation } from "../Observation";
import { mean } from "../SummarizeOperations";

describe("Column name collisions (overwrite semantics)", () => {
  it("mutate overwrites an existing column without error", () => {
    const d: Array<Observation> = [{ a: 1 }, { a: 2 }];
    const dc = new DataCalc(d).mutate({ a: (o) => o.a + 10 });

    expect(dc.pull("a")).toEqual([11, 12]);
  });

  it("subsequent mutate in the same chain overwrites previous value", () => {
    const d: Array<Observation> = [{ b: 1 }, { b: 2 }];
    const dc = new DataCalc(d)
      .mutate({ b: (o) => o.b + 1 })
      .mutate({ b: (o) => o.b * 3 });

    // Expect b: (original b +1)*3 -> [6,9]
    expect(dc.pull("b")).toEqual([6, 9]);
  });

  it("rename to an existing name overwrites the existing column", () => {
    const d: Array<Observation> = [{ a: 5, x: 99 }];
    const dc = new DataCalc(d).rename({ x: "a" });

    // After rename, 'x' should hold the former 'a' value (5). Original 'x' replaced.
    expect(dc.observations[0]).toEqual({ x: 5 });
  });

  it("summarize can create a column with the same name as a group and it overwrites", () => {
    const d: Array<Observation> = [
      { g: "a", v: 1 },
      { g: "a", v: 3 },
      { g: "b", v: 2 },
    ];

    const dc = new DataCalc(d).groupBy("g").summarize({ g: mean("v") });

    // summarize returns rows where the group identifier `g` has been overwritten
    // by the numeric summary (overwrite semantics allowed)
    const obs = dc.observations
      .map((r) => r.g)
      .sort((x, y) => Number(x) - Number(y));
    expect(obs).toEqual([2, 2]);
  });

  it("rename logs a warning when warnings are enabled and collisions occur", () => {
    const d: Array<Observation> = [{ a: 5, x: 99 }];
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const dc = new DataCalc(d, { warnings: true });
      dc.rename({ x: "a" });
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("renaming will overwrite existing variables"),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("rename does not warn when warnings disabled", () => {
    const d: Array<Observation> = [{ a: 5, x: 99 }];
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const dc = new DataCalc(d, { warnings: false });
      dc.rename({ x: "a" });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
