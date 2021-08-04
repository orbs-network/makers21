const BASE_SIZE = 10;
const SIZE = BASE_SIZE;
const BLUE = 0x000055;
const RED = 0x550000;
const BLUE2 = 0x000088;
const RED2 = 0x880000;
const GREY = 0x111111;
const WHITE = 0xFFFFFF;

window.config = {
  size:SIZE ,
  speed: SIZE/150,
  //speed: BASE_SIZE/100,
  //speed: 0,
  fps:30,
  gateSpeed : 0.02,
  steerReleaseFactor: 0.95,
  horizLimit:0.02,
  vertLimit:0.005,
  rotUnit:0.001,
  bordersAlarmFactor:10,
  numObstacles: 10,
  ObstaclesGridDivider: 10
};

window.config.collisionDistance= window.config.speed * 5;
