// Game configuration constants
const SIZE = 500;
const HEIGHT = SIZE * 0.4;
const GATE_SIZE = SIZE / 60;

// Color constants
const BLUE = 0x224988;
const RED = 0x704320;
const BLUE2 = 0x0044ff;
const BLUE_SHIP = 0x000411;
const RED2 = 0xff3300;
const RED_SHIP = 0x110500;
const GREY = 0x333344;
const WHITE = 0xFFFFFF;

const toRad = (Math.PI / 180);

// Main game configuration object
const config = {
  size: SIZE,
  distancePerMS: SIZE / 9000, // half court in 15 sec
  gateTurnPerSec: 0.15,
  vertLimit: 0.90,
  maxFaceX: 0, // zero should turn it off 0.2, gimble in face.js 0 is zero max face turn is 0.2
  playSphereFactor: 1.6, // control shooting sphere size
  updateInterval: 100,
  return2startSec: 5,
  explodePartSize: SIZE / 500, // (2)
  raycastNear: 0,
  raycastFar: 2 * SIZE,
  secCrossBorder: 2, // 2 sec explode outside border
  newTargetDelay: 100, // ms
  groundRaycastEvery: 15
};

// Extended configuration
config.shootNear = 0; // SIZE / 10;
config.shootFar = SIZE;
config.passFlagNear = 0;
config.passFlagFar = SIZE * 1.3; // advantage

config.targetLockMs = 1000;

config.colideDistance = config.distancePerMS * 200;
config.gatePassDistance = config.distancePerMS * 200;
config.lookSpeed = config.distancePerMS * 0.007; // 0.0005,

// Make config available globally for legacy compatibility
window.config = config;

// Also export the constants globally for legacy code
window.SIZE = SIZE;
window.HEIGHT = HEIGHT;
window.GATE_SIZE = GATE_SIZE;
window.BLUE = BLUE;
window.RED = RED;
window.BLUE2 = BLUE2;
window.BLUE_SHIP = BLUE_SHIP;
window.RED2 = RED2;
window.RED_SHIP = RED_SHIP;
window.GREY = GREY;
window.WHITE = WHITE;
window.toRad = toRad;

// ES6 exports for modern usage
export {
  SIZE,
  HEIGHT,
  GATE_SIZE,
  BLUE,
  RED,
  BLUE2,
  BLUE_SHIP,
  RED2,
  RED_SHIP,
  GREY,
  WHITE,
  toRad,
  config as default
};