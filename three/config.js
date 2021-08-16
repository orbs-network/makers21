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
  speed: BASE_SIZE/200,
  //speed: 0,
  fps:30,
  gateSpeed : 0.01,
  //ctrlHeightLimit: (20 * toRad)
  // steerReleaseFactor: 0.95,
  // horizLimit:0.02,
  vertLimit:0.40,
  lookSpeed:0.005,
  // rotUnit:0.001,
};


config.targetNear = SIZE /10;
config.targetFar = config.targetNear + 2*SIZE;

config.colideNear = 0;
config.colideFar= SIZE/10;
config.colideDistance= window.config.speed * 10;
