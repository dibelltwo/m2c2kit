/* eslint-disable @typescript-eslint/ban-ts-comment */
import { RandomDraws } from "..";

describe("test SingleFromRange", () => {
  it("throws error when inputs are not integers", () => {
    expect(() => {
      RandomDraws.singleFromRange(0, 5.5);
    }).toThrow(Error);
  });

  it("throws error when minimumInclusive > maximumInclusive", () => {
    expect(() => {
      RandomDraws.singleFromRange(10, 5);
    }).toThrow(Error);
  });

  it("draw is an integer from the range (1000 iterations)", () => {
    const iterations = 1000;
    const minInclusive = 0;
    const maxInclusive = 5;
    const draws = new Array<number>();
    for (let i = 0; i < iterations; i++) {
      const value = RandomDraws.singleFromRange(minInclusive, maxInclusive);
      draws.push(value);
    }
    expect(
      draws.every(
        (v) => Math.round(v) === v && v >= minInclusive && v <= maxInclusive,
      ),
    ).toBeTruthy();
  });

  it("draws all numbers within the range at least once (1000 iterations)", () => {
    const iterations = 1000;
    const minInclusive = 0;
    const maxInclusive = 5;
    const draws = new Array<number>();
    for (let i = 0; i < iterations; i++) {
      const value = RandomDraws.singleFromRange(minInclusive, maxInclusive);
      draws.push(value);
    }
    const numberWasDrawn = new Array<boolean>();
    for (let i = 0; i <= maxInclusive; i++) {
      numberWasDrawn[i] = false;
    }

    draws.forEach((d) => {
      numberWasDrawn[d] = true;
    });
    expect(numberWasDrawn.every((n) => n)).toBeTruthy();
  });

  it("draws are from a uniform distribution (10000 iterations)", () => {
    const iterations = 10000;
    const minInclusive = 0;
    const maxInclusive = 5;
    const draws = new Array<number>();
    for (let i = 0; i < iterations; i++) {
      const value = RandomDraws.singleFromRange(minInclusive, maxInclusive);
      draws.push(value);
    }
    const average = draws.reduce((a, b) => a + b) / draws.length;

    /**
     * for a uniform distribution with range [0,5],
     * true mean is 2.5
     * true standard deviation is sqrt((5-0)^2 / 12) = 1.443376
     * with 10,000 draws, how likely is it we would observe a
     * mean more than .1 off the true mean?
     * z-score = (.1) / (1.443376 / (sqrt(10000))) = 6.9
     * p-value is 5.200285e-12
     * highly unlikely (less than 1 in a billion),
     * so OK to use this in our test
     */
    expect(Math.abs(average - 2.5)).toBeLessThan(0.1);
  });
});

describe("test FromRangeWithoutReplacement", () => {
  it.each([[0], [1], [2], [3], [4], [5], [6]])(
    "returns an array with expected number of draws",
    (n) => {
      const minInclusive = 0;
      const maxInclusive = 5;
      const draws = RandomDraws.fromRangeWithoutReplacement(
        n,
        minInclusive,
        maxInclusive,
      );
      expect(draws.length).toEqual(n);
    },
  );

  it("chooses random numbers without replacement (100 iterations)", () => {
    const iterations = 100;
    const minInclusive = 0;
    const maxInclusive = 5;
    const n = 4;

    const uniqueNumbers = new Array<number>();
    for (let i = 0; i < iterations; i++) {
      const d = RandomDraws.fromRangeWithoutReplacement(
        n,
        minInclusive,
        maxInclusive,
      );
      uniqueNumbers.push(new Set(d).size);
    }

    expect(uniqueNumbers.every((u) => u === n)).toBeTruthy();
  });

  it("throws error if number of requested draws is greater than integers available within range", () => {
    const minInclusive = 0;
    const maxInclusive = 5;

    const d = () =>
      RandomDraws.fromRangeWithoutReplacement(
        maxInclusive + 2,
        minInclusive,
        maxInclusive,
      );

    expect(d).toThrow(Error);
  });

  it("returns an empty array when n = 0", () => {
    const draws = RandomDraws.fromRangeWithoutReplacement(0, 0, 5);
    expect(draws).toEqual([]);
  });

  it("returns all values in the range when n equals range size", () => {
    const minInclusive = 0;
    const maxInclusive = 5;
    const n = maxInclusive - minInclusive + 1;
    const draws = RandomDraws.fromRangeWithoutReplacement(
      n,
      minInclusive,
      maxInclusive,
    );
    const expectedSet = new Set(Array.from({ length: n }, (_, i) => i));
    expect(new Set(draws)).toEqual(expectedSet);
  });

  it("handles ranges with negative numbers", () => {
    const draws = RandomDraws.fromRangeWithoutReplacement(3, -5, -1);
    expect(draws.length).toBe(3);
    draws.forEach((num) => {
      expect(num).toBeGreaterThanOrEqual(-5);
      expect(num).toBeLessThanOrEqual(-1);
    });
  });

  it("returns the only value when range has one value and n = 1", () => {
    const draws = RandomDraws.fromRangeWithoutReplacement(1, 5, 5);
    expect(draws).toEqual([5]);
  });

  it("returns empty array when range has one value and n = 0", () => {
    const draws = RandomDraws.fromRangeWithoutReplacement(0, 5, 5);
    expect(draws).toEqual([]);
  });

  it("throws error when n > 1 and range has only one value", () => {
    expect(() => {
      RandomDraws.fromRangeWithoutReplacement(2, 5, 5);
    }).toThrow(Error);
  });

  it("samples correctly from a large range", () => {
    const draws = RandomDraws.fromRangeWithoutReplacement(5, 0, 1_000_000_000);
    expect(draws.length).toBe(5);
    const unique = new Set(draws);
    expect(unique.size).toBe(5);
  });

  it("throws error when inputs are not integers", () => {
    expect(() => {
      RandomDraws.fromRangeWithoutReplacement(3.5, 0, 5);
    }).toThrow(Error);
  });

  it("throws error when minimumInclusive > maximumInclusive", () => {
    expect(() => {
      RandomDraws.fromRangeWithoutReplacement(1, 10, 5);
    }).toThrow(Error);
  });
});

describe("test FromGridWithoutReplacement", () => {
  it.each([[0], [1], [2], [3], [4], [5], [6], [7], [8], [20]])(
    "returns an array with expected number of grid draws",
    (n) => {
      const rows = 4;
      const columns = 5;
      const draws = RandomDraws.fromGridWithoutReplacement(n, rows, columns);
      expect(draws.length).toEqual(n);
    },
  );

  it("draws all grid cells within the range at least once (10000 iterations)", () => {
    const iterations = 10000;
    const rows = 4;
    const columns = 5;

    const draws = new Array<Array<{ row: number; column: number }>>();

    for (let i = 0; i < iterations; i++) {
      const cells = RandomDraws.fromGridWithoutReplacement(1, rows, columns);
      draws.push(cells);
    }

    const cellWasDrawn = new Array<Array<boolean>>(rows);
    for (let i = 0; i < rows; i++) {
      cellWasDrawn[i] = new Array<boolean>(columns);
      for (let j = 0; j < columns; j++) {
        cellWasDrawn[i][j] = false;
      }
    }

    draws.forEach((d) =>
      d.forEach((c) => {
        cellWasDrawn[c.row][c.column] = true;
      }),
    );

    expect(cellWasDrawn.flat().every((c) => c)).toBeTruthy();
  });
});

describe("test seeded PRNG", () => {
  it("returns expected random number when using seeded PRNG", () => {
    RandomDraws.setSeed("test-seed");
    const draw = RandomDraws.singleFromRange(0, 10_000_000_000);
    expect(draw).toBe(3490856405);
  });

  it("stops using seeded PRNG after calling useDefaultRandom", () => {
    RandomDraws.setSeed("test-seed");
    RandomDraws.useDefaultRandom();
    const draw = RandomDraws.singleFromRange(0, 10_000_000_000);
    expect(draw).not.toBe(3490856405);
  });
});

describe("test random", () => {
  it("returns values in the expected range when using seeded PRNG", () => {
    RandomDraws.setSeed("test-seed");
    const iterations = 1000;
    const draws = new Array<number>();
    for (let i = 0; i < iterations; i++) {
      const value = RandomDraws.random();
      draws.push(value);
    }
    expect(draws.every((v) => v >= 0 && v < 1)).toBeTruthy();
  });

  it("returns values in the expected range when using default Math.random", () => {
    const iterations = 1000;
    const draws = new Array<number>();
    for (let i = 0; i < iterations; i++) {
      const value = RandomDraws.random();
      draws.push(value);
    }
    expect(draws.every((v) => v >= 0 && v < 1)).toBeTruthy();
  });

  it("it has the mean in an expected interval when using seeded PRNG", () => {
    RandomDraws.setSeed("test-seed");
    const iterations = 5000;
    let sum = 0;
    for (let i = 0; i < iterations; i++) {
      const value = RandomDraws.random();
      sum += value;
    }
    const mean = sum / iterations;
    // outside this interval would be very unlikely (less than 1 in a quadrillion)
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it("it has the mean in an expected interval when using default Math.random", () => {
    const iterations = 5000;
    let sum = 0;
    for (let i = 0; i < iterations; i++) {
      const value = RandomDraws.random();
      sum += value;
    }
    const mean = sum / iterations;
    // outside this interval would be very unlikely (less than 1 in a quadrillion)
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});
