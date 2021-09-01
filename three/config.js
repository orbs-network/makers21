const BASE_SIZE = 10;
const SIZE = BASE_SIZE;
const BLUE = 0x000055;
const RED = 0x550000;
const BLUE2 = 0x000088;
const RED2 = 0x880000;
const GREY = 0x111111;
const WHITE = 0xFFFFFF;

const toRad = (Math.PI/180);

window.config = {
  size:SIZE ,
  //speed: SIZE/400,
  //speed: BASE_SIZE/500,
  //speed: 0,
  distancePerMS : 1.5/1000,
  gateTurnPerSec : 0.2,
  //ctrlHeightLimit: (20 * toRad)
  // steerReleaseFactor: 0.95,
  // horizLimit:0.02,
  vertLimit:0.40,
  updateInterval:100
  // rotUnit:0.001,
};


config.targetNear = SIZE /10;
config.targetFar = config.targetNear + 2*SIZE;
config.targetLockMs = 2000;

config.colideNear = 0;
config.colideFar= SIZE/10;
config.colideDistance= config.distancePerMS * 500;
config.lookSpeed = config.distancePerMS * 0.1;//0.0005,
