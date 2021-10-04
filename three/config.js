const BASE_SIZE = 10;
const SIZE = BASE_SIZE;
const BLUE = 0x000055;
const RED = 0x550000;
const BLUE2 = 0x000088;
const RED2 = 0x880000;
const GREY = 0x331133;
const WHITE = 0xFFFFFF;

const toRad = (Math.PI/180);

window.config = {
  size:SIZE ,
  //speed: SIZE/400,
  //speed: BASE_SIZE/500,
  //speed: 0,
  distancePerMS : 1.6/1000,
  gateTurnPerSec : 0.1,
  //ctrlHeightLimit: (20 * toRad)
  // steerReleaseFactor: 0.95,
  // horizLimit:0.02,
  vertLimit:0.60,
  updateInterval:500,
  playerSphereSize: 0.1,
  return2startSec: 5,
  explodePartSize: 0.05,
  // rotUnit:0.001,
  raycastNear:0,
  raycastFar:SIZE*2
};


config.shootNear = 1;
config.shootFar = config.shootNear + SIZE * 1.3;
config.passNear = 0;
config.passFar = config.shootFar + 2;

config.targetLockMs = 1000;

config.colideDistance= config.distancePerMS * 500;
config.lookSpeed = config.distancePerMS * 0.1;//0.0005,
