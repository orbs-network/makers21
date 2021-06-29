const BASE_SIZE = 10;

window.config = {
    size: BASE_SIZE,
    speed: BASE_SIZE / (localStorage.getItem("speed") || 200), // 250 - 10
    fps: 30,
    gateSpeed: (localStorage.getItem("gateSpeed") || 0.005), // 0.005 - 0.12
    steerReleaseFactor: 0.95,
    horizLimit: 0.02, //
    vertLimit: 0.005, //
    rotUnit: 0.001,
};