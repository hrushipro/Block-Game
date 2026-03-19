const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24;

context.scale(BLOCK_SIZE, BLOCK_SIZE);

const arena = createMatrix(COLS, ROWS);
const colors = [
  null,
  "#44d4ff", // I
  "#ffd447", // O
  "#8d7bff", // T
  "#7bff8b", // S
  "#ff7b7b", // Z
  "#7ba0ff", // J
  "#ffb97b", // L
];

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  score: 0,
  lines: 0,
};

// ── Sound effects (Web Audio API) ──────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playDropSound() {
  const ctx = getAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(160, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

function playClearSound(lines) {
  const ctx = getAudio();
  const freqs = [330, 440, 550, 660];
  freqs.slice(0, lines).forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.06;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.15);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

let dropCounter = 0;
let dropInterval = 800;
let lastTime = 0;

function arenaSweep() {
  let cleared = 0;
  outer: for (let y = arena.length - 1; y > 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }

    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++y;
    cleared++;
  }

  if (cleared > 0) {
    const lineScores = [0, 100, 300, 500, 800];
    player.score += lineScores[Math.min(cleared, 4)];
    player.lines += cleared;
    playClearSound(cleared);
  }
}

function collide(arenaGrid, playerData) {
  const matrix = playerData.matrix;
  const offset = playerData.pos;

  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < matrix[y].length; ++x) {
      if (
        matrix[y][x] !== 0 &&
        (arenaGrid[y + offset.y] && arenaGrid[y + offset.y][x + offset.x]) !== 0
      ) {
        return true;
      }
    }
  }

  return false;
}

function createMatrix(width, height) {
  const matrix = [];
  while (height--) {
    matrix.push(new Array(width).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  if (type === "I") {
    return [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ];
  }
  if (type === "L") {
    return [
      [0, 0, 6],
      [6, 6, 6],
      [0, 0, 0],
    ];
  }
  if (type === "J") {
    return [
      [7, 0, 0],
      [7, 7, 7],
      [0, 0, 0],
    ];
  }
  if (type === "O") {
    return [
      [2, 2],
      [2, 2],
    ];
  }
  if (type === "T") {
    return [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0],
    ];
  }
  if (type === "S") {
    return [
      [0, 4, 4],
      [4, 4, 0],
      [0, 0, 0],
    ];
  }
  if (type === "Z") {
    return [
      [5, 5, 0],
      [0, 5, 5],
      [0, 0, 0],
    ];
  }
  return [[1]];
}

function draw() {
  context.fillStyle = "#0a0f19";
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawMatrix(arena, { x: 0, y: 0 });
  drawMatrix(player.matrix, player.pos);
}

// Parse a "#rrggbb" hex colour into [r, g, b] integer components.
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawBlock(bx, by, color) {
  const pad = 0.05;
  const r = 0.14;
  const w = 1 - pad * 2;
  const [cr, cg, cb] = hexToRgb(color);

  // Base rounded block
  context.beginPath();
  context.roundRect(bx + pad, by + pad, w, w, r);
  context.fillStyle = color;
  context.fill();

  // Gradient overlay for 3D depth (top-left bright → bottom-right dark)
  const grad = context.createLinearGradient(bx, by, bx + 1, by + 1);
  grad.addColorStop(0, "rgba(255,255,255,0.32)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.04)");
  grad.addColorStop(1, "rgba(0,0,0,0.36)");
  context.fillStyle = grad;
  context.fill();

  // Bottom-right shadow strip for extra depth
  const shadowGrad = context.createLinearGradient(bx, by + 0.62, bx, by + 1);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0.32)");
  context.fillStyle = shadowGrad;
  context.fill();

  // Border: a darker shade of the block colour so all blocks are visually
  // separated from neighbours regardless of their hue.
  context.strokeStyle = `rgba(${Math.max(0, cr - 65)},${Math.max(0, cg - 65)},${Math.max(0, cb - 65)},0.88)`;
  context.lineWidth = 0.07;
  context.stroke();

  // Top-left shine highlight
  context.beginPath();
  context.roundRect(bx + pad + 0.08, by + pad + 0.08, 0.34, 0.17, 0.06);
  context.fillStyle = "rgba(255,255,255,0.52)";
  context.fill();
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(x + offset.x, y + offset.y, colors[value]);
      }
    });
  });
}

function merge(arenaGrid, playerData) {
  playerData.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arenaGrid[y + playerData.pos.y][x + playerData.pos.x] = value;
      }
    });
  });
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playDropSound();
    playerReset();
    arenaSweep();
    updateScore();
  }
  dropCounter = 0;
}

function playerMove(direction) {
  player.pos.x += direction;
  if (collide(arena, player)) {
    player.pos.x -= direction;
  }
}

function playerReset() {
  const pieces = "ILJOTSZ";
  const piece = pieces[(pieces.length * Math.random()) | 0];
  player.matrix = createPiece(piece);
  player.pos.y = 0;
  player.pos.x = ((COLS / 2) | 0) - ((player.matrix[0].length / 2) | 0);

  if (collide(arena, player)) {
    arena.forEach((row) => row.fill(0));
    player.score = 0;
    player.lines = 0;
    updateScore();
  }
}

function playerRotate(direction) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, direction);

  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));

    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -direction);
      player.pos.x = pos;
      return;
    }
  }
}

function rotate(matrix, direction) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }

  if (direction > 0) {
    matrix.forEach((row) => row.reverse());
  } else {
    matrix.reverse();
  }
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  requestAnimationFrame(update);
}

function updateScore() {
  scoreEl.textContent = player.score;
  linesEl.textContent = player.lines;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    playerMove(-1);
  } else if (event.key === "ArrowRight") {
    playerMove(1);
  } else if (event.key === "ArrowDown") {
    playerDrop();
  } else if (event.key === "q" || event.key === "Q") {
    playerRotate(-1);
  } else if (event.key === "w" || event.key === "W" || event.key === "ArrowUp") {
    playerRotate(1);
  }
});

playerReset();
updateScore();
update();

// Export pure functions for unit testing
if (typeof module !== "undefined") {
  module.exports = {
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
  };
}
