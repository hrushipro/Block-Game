/**
 * JSDOM does not implement the Canvas API or Web Audio API, so we provide
 * minimal stubs so that game.js can be loaded without throwing when it calls
 * canvas.getContext('2d') and the audio/context methods at module
 * initialisation time.
 */

// ── Web Audio API stub ───────────────────────────────────────────────────────
class FakeGain {
  connect() {}
  get gain() {
    return { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  }
}

class FakeOscillator {
  connect() {}
  start() {}
  stop() {}
  get frequency() {
    return { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
  }
  set type(_) {}
}

class FakeAudioContext {
  get currentTime() {
    return 0;
  }
  createOscillator() {
    return new FakeOscillator();
  }
  createGain() {
    return new FakeGain();
  }
  get destination() {
    return {};
  }
}

window.AudioContext = FakeAudioContext;
window.webkitAudioContext = FakeAudioContext;

// ── Canvas 2-D rendering context stub ────────────────────────────────────────
class FakeGradient {
  addColorStop() {}
}

const ctx2d = {
  scale: jest.fn(),
  fillRect: jest.fn(),
  fill: jest.fn(),
  beginPath: jest.fn(),
  roundRect: jest.fn(),
  createLinearGradient: jest.fn(() => new FakeGradient()),
  save: jest.fn(),
  restore: jest.fn(),
  fillText: jest.fn(),
  fillStyle: "",
  font: "",
  textAlign: "",
  textBaseline: "",
};

HTMLCanvasElement.prototype.getContext = jest.fn(() => ctx2d);

// Expose the stub so individual tests can inspect canvas calls if needed
global.__ctx2d = ctx2d;
