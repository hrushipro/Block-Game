const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

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
};

let dropCounter = 0;
let dropInterval = 800;
let lastTime = 0;

function arenaSweep() {
  let rowCount = 1;
  outer: for (let y = arena.length - 1; y > 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }

    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++y;

    player.score += rowCount * 10;
    rowCount *= 2;
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

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = colors[value];
        context.fillRect(x + offset.x, y + offset.y, 1, 1);

        context.strokeStyle = "rgba(10, 15, 25, 0.5)";
        context.lineWidth = 0.05;
        context.strokeRect(x + offset.x, y + offset.y, 1, 1);
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
