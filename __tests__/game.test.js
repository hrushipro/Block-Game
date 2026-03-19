/**
 * game.test.js
 *
 * Unit tests for the Block-Game (Tetris) implementation.
 * Covers:
 *  - Scoring for completed lines (100 / 300 / 500 / 800 rule)
 *  - Detailed block rendering using gradient + shine overlay
 *  - Core game-logic helpers: createMatrix, createPiece, collide, merge, rotate
 *  - Arena sweep: rows are removed and score / line-count updated correctly
 */

// ── Module setup ─────────────────────────────────────────────────────────────
// game.js writes to the DOM on load, so we add the expected elements first.
document.body.innerHTML = `
  <canvas id="tetris" width="240" height="480"></canvas>
  <span id="score">0</span>
  <span id="lines">0</span>
`;

// Load game.js (runs immediately, hits playerReset + updateScore + update)
const {
  createMatrix,
  createPiece,
  collide,
  merge,
  rotate,
  arenaSweep,
  arena,
  player,
  colors,
  hexToRgb,
} = require("../game.js");

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Return a fresh COLS×ROWS empty arena (mirrors game.js dimensions). */
function freshArena(cols = 10, rows = 20) {
  return createMatrix(cols, rows);
}

/** Fill the bottom `n` rows of an arena completely (every cell = 1). */
function fillRows(arenaGrid, n) {
  const startY = arenaGrid.length - n;
  for (let y = startY; y < arenaGrid.length; y++) {
    arenaGrid[y].fill(1);
  }
}

// ── createMatrix ─────────────────────────────────────────────────────────────
describe("createMatrix", () => {
  test("returns correct dimensions", () => {
    const m = createMatrix(5, 3);
    expect(m.length).toBe(3);
    m.forEach((row) => expect(row.length).toBe(5));
  });

  test("every cell starts as 0", () => {
    const m = createMatrix(4, 4);
    m.forEach((row) => row.forEach((cell) => expect(cell).toBe(0)));
  });
});

// ── createPiece ───────────────────────────────────────────────────────────────
describe("createPiece", () => {
  const pieces = ["I", "L", "J", "O", "T", "S", "Z"];

  test.each(pieces)("piece %s is a non-empty 2D array", (type) => {
    const m = createPiece(type);
    expect(Array.isArray(m)).toBe(true);
    expect(m.length).toBeGreaterThan(0);
    m.forEach((row) => expect(Array.isArray(row)).toBe(true));
  });

  test("I piece is 4 rows tall", () => {
    expect(createPiece("I").length).toBe(4);
  });

  test("O piece is a 2×2 square", () => {
    const o = createPiece("O");
    expect(o.length).toBe(2);
    expect(o[0].length).toBe(2);
    o.forEach((row) => row.forEach((cell) => expect(cell).not.toBe(0)));
  });

  test("color indices are within the colors array bounds", () => {
    pieces.forEach((type) => {
      createPiece(type).forEach((row) =>
        row.forEach((cell) => {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(colors.length);
        })
      );
    });
  });
});

// ── rotate ────────────────────────────────────────────────────────────────────
describe("rotate", () => {
  test("clockwise rotation transposes and reverses rows", () => {
    const m = [
      [1, 2],
      [3, 4],
    ];
    rotate(m, 1); // clockwise
    expect(m).toEqual([
      [3, 1],
      [4, 2],
    ]);
  });

  test("counter-clockwise rotation transposes and reverses columns", () => {
    const m = [
      [1, 2],
      [3, 4],
    ];
    rotate(m, -1); // counter-clockwise
    expect(m).toEqual([
      [2, 4],
      [1, 3],
    ]);
  });

  test("four clockwise rotations return to original", () => {
    const original = createPiece("T");
    const m = createPiece("T");
    rotate(m, 1);
    rotate(m, 1);
    rotate(m, 1);
    rotate(m, 1);
    expect(m).toEqual(original);
  });
});

// ── collide ───────────────────────────────────────────────────────────────────
describe("collide", () => {
  test("no collision in an empty arena", () => {
    const a = freshArena();
    const p = { matrix: createPiece("O"), pos: { x: 0, y: 0 } };
    expect(collide(a, p)).toBe(false);
  });

  test("detects collision with settled blocks", () => {
    const a = freshArena();
    a[0][0] = 1; // block at top-left
    const p = { matrix: [[1]], pos: { x: 0, y: 0 } };
    expect(collide(a, p)).toBe(true);
  });

  test("detects collision at the bottom boundary", () => {
    const a = freshArena();
    // Place piece so its bottom row would be out of bounds (arena row undefined)
    const p = { matrix: [[1]], pos: { x: 0, y: 20 } };
    // arena[20] is undefined, so (undefined && ...) === undefined which !== 0 → collision
    expect(collide(a, p)).toBe(true);
  });

  test("no collision when piece is fully inside arena", () => {
    const a = freshArena();
    const p = { matrix: createPiece("L"), pos: { x: 3, y: 5 } };
    expect(collide(a, p)).toBe(false);
  });
});

// ── merge ─────────────────────────────────────────────────────────────────────
describe("merge", () => {
  test("writes piece values into the arena at the correct position", () => {
    const a = freshArena();
    const p = { matrix: [[2, 2], [2, 2]], pos: { x: 1, y: 0 } };
    merge(a, p);
    expect(a[0][1]).toBe(2);
    expect(a[0][2]).toBe(2);
    expect(a[1][1]).toBe(2);
    expect(a[1][2]).toBe(2);
  });

  test("does not overwrite zeros from sparse piece matrix", () => {
    const a = freshArena();
    a[0][0] = 5; // pre-existing block
    const p = { matrix: [[0, 3]], pos: { x: 0, y: 0 } };
    merge(a, p);
    expect(a[0][0]).toBe(5); // untouched
    expect(a[0][1]).toBe(3);
  });
});

// ── arenaSweep & scoring ──────────────────────────────────────────────────────
describe("arenaSweep – scoring for completed lines", () => {
  /**
   * Run arenaSweep against the shared arena/player exposed by game.js, but
   * first we reset their state so each test is independent.
   */
  function setupAndSweep(filledRowCount) {
    // Reset arena to empty
    arena.forEach((row) => row.fill(0));
    // Reset player score & lines
    player.score = 0;
    player.lines = 0;
    // Fill the requested number of bottom rows
    fillRows(arena, filledRowCount);
    arenaSweep();
  }

  test("no full rows → score stays 0, lines stay 0", () => {
    setupAndSweep(0);
    expect(player.score).toBe(0);
    expect(player.lines).toBe(0);
  });

  test("1 completed line → 100 points, 1 line counted", () => {
    setupAndSweep(1);
    expect(player.score).toBe(100);
    expect(player.lines).toBe(1);
  });

  test("2 completed lines → 300 points, 2 lines counted", () => {
    setupAndSweep(2);
    expect(player.score).toBe(300);
    expect(player.lines).toBe(2);
  });

  test("3 completed lines → 500 points, 3 lines counted", () => {
    setupAndSweep(3);
    expect(player.score).toBe(500);
    expect(player.lines).toBe(3);
  });

  test("4 completed lines (Tetris) → 800 points, 4 lines counted", () => {
    setupAndSweep(4);
    expect(player.score).toBe(800);
    expect(player.lines).toBe(4);
  });

  test("cleared rows are removed from the arena (arena shrinks from top)", () => {
    arena.forEach((row) => row.fill(0));
    player.score = 0;
    player.lines = 0;
    fillRows(arena, 2);
    arenaSweep();
    // The top two rows should now be empty (zeroed) because cleared rows are
    // prepended as empty rows
    expect(arena[0].every((c) => c === 0)).toBe(true);
    expect(arena[1].every((c) => c === 0)).toBe(true);
  });

  test("partially filled row is NOT cleared", () => {
    arena.forEach((row) => row.fill(0));
    player.score = 0;
    player.lines = 0;
    // Fill the last row but leave one gap
    arena[arena.length - 1].fill(1);
    arena[arena.length - 1][5] = 0; // gap
    arenaSweep();
    expect(player.score).toBe(0);
    expect(player.lines).toBe(0);
  });
});

// ── Gradient block rendering ──────────────────────────────────────────────────
describe("gradient block rendering (drawBlock)", () => {
  test("canvas createLinearGradient is called when drawing the board", () => {
    // The canvas draw calls happen continuously via requestAnimationFrame,
    // but game.js calls draw() at least once during update() at load time.
    // The setup mock records all calls.
    const grad = global.__ctx2d.createLinearGradient;
    expect(grad).toHaveBeenCalled();
  });

  test("canvas roundRect is called for block rendering", () => {
    expect(global.__ctx2d.roundRect).toHaveBeenCalled();
  });

  test("canvas fill is called for each block layer", () => {
    expect(global.__ctx2d.fill).toHaveBeenCalled();
  });

  test("canvas stroke is called for the block border", () => {
    expect(global.__ctx2d.stroke).toHaveBeenCalled();
  });
});

// ── colors palette ────────────────────────────────────────────────────────────
describe("colors palette", () => {
  test("index 0 is null (empty cell sentinel)", () => {
    expect(colors[0]).toBeNull();
  });

  test("has 8 entries (null + one per tetromino type)", () => {
    expect(colors.length).toBe(8);
  });

  test("non-null entries are CSS colour strings", () => {
    colors.slice(1).forEach((c) => {
      expect(typeof c).toBe("string");
      expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

// ── hexToRgb ──────────────────────────────────────────────────────────────────
describe("hexToRgb", () => {
  test("pure white #ffffff → [255, 255, 255]", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  test("pure black #000000 → [0, 0, 0]", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  test("pure red #ff0000 → [255, 0, 0]", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
  });

  test("pure green #00ff00 → [0, 255, 0]", () => {
    expect(hexToRgb("#00ff00")).toEqual([0, 255, 0]);
  });

  test("pure blue #0000ff → [0, 0, 255]", () => {
    expect(hexToRgb("#0000ff")).toEqual([0, 0, 255]);
  });

  test("each game colour parses to three integers in 0–255", () => {
    colors.slice(1).forEach((hex) => {
      const [r, g, b] = hexToRgb(hex);
      [r, g, b].forEach((ch) => {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
        expect(Number.isInteger(ch)).toBe(true);
      });
    });
  });
});
