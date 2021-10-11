
const SIZE = 200;
const HEIGHT = 120;
const BLUE = 0x224988;
const RED = 0x703020;
const BLUE2 = 0x003070;
const BLUE_SHIP = 0x000411;
const RED2 = 0x882200;
const RED_SHIP = 0x110100;
const GREY = 0x333344;
const WHITE = 0xFFFFFF;

const toRad = (Math.PI/180);

window.config = {
  size:SIZE ,
  distancePerMS : SIZE/4000, // half cort in 4 sec
  gateTurnPerSec : 0.1,
  //ctrlHeightLimit: (20 * toRad)
  // steerReleaseFactor: 0.95,
  // horizLimit:0.02,
  vertLimit:0.60,
  updateInterval:300,
  return2startSec: 5,
  explodePartSize: 0.02,
  // rotUnit:0.001,
  raycastNear:0,
  raycastFar:SIZE
};


config.shootNear = SIZE / 20;
config.shootFar = config.shootNear + SIZE * 1.3;
config.passNear = 0;
config.passFar = config.shootFar + 2;

config.targetLockMs = 1000;

config.colideDistance = config.distancePerMS * 50;
config.gatePassDistance = config.distancePerMS * 200;
config.lookSpeed = config.distancePerMS * 0.003;//0.0005,
