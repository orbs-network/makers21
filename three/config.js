const SIZE = 30;
const HEIGHT = 13;
const GATE_SIZE = (SIZE/ 2) / 80;

const BLUE = 0x224988;
const RED = 0x703020;
const BLUE2 = 0x0044ff;
const BLUE_SHIP = 0x000411;
const RED2 = 0xff3300;
const RED_SHIP = 0x110500;
const GREY = 0x333344;
const WHITE = 0xFFFFFF;

const toRad = (Math.PI / 180);

window.config = {
  size: SIZE,
  distancePerMS: SIZE / 8000, // half cort in 15 sec
  gateTurnPerSec: 0.15,
  //ctrlHeightLimit: (20 * toRad)
  // steerReleaseFactor: 0.95,
  //  horizLimit:0.02,
  vertLimit: 0.90,
  maxFaceX: 0.1 , // gimble in face.js 0 is zero max face turn is 0.2
  playSphereFactor: 1.6, //control shooting sphere size
  updateInterval:500,
  return2startSec: 5,
  explodePartSize: SIZE / 500, //(2)
  // rotUnit:0.001,
  raycastNear:0,
  raycastFar:2 * SIZE,
  secCrossBorder:2, // 2 sec explode outside border
  newTargetDelay:100 //ms
};


config.shootNear = 0;//SIZE / 10;
config.shootFar =  SIZE;
config.passFlagNear = 0;
config.passFlagFar = SIZE * 1.3; // advantage

config.targetLockMs = 1000;

config.colideDistance = config.distancePerMS * 50;
config.gatePassDistance = config.distancePerMS * 100;
config.lookSpeed = config.distancePerMS * 0.01; //0.0005,