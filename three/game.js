class Game /*extends THREE.EventDispatcher*/ {
  //////////////////////////////////////////////////////////
  constructor(){
    //super();

    this.start = false;
    this.first = true;
    this.exploding = false;

    // this.v2.x = ( 0.5 ) * 2 - 1;
	  // this.v2.y = - ( 0.5 ) * 2 + 1;
    //this.v3 =  new THREE.Vector3(0.5,0.5,0.5);

    //this.steering = new Steering();
  }
  //////////////////////////////////////////////////////////
  loadAsync(cb){
    //load flag template
    // this.flagObj = null;

	  // this.redFlag = new Flag(this, this.flagObj, RED);
    // this.blueFlag = new Flag(this, this.flagObj, BLUE);

    cb();
  }
  //////////////////////////////////////////////////////////
  startStop(){
    this.start = !this.start;
    this.controls.autoForward = this.start;
    deepStream.sendEvent('player',{
      type:"start",
      moving:this.start,
      pos:this.position
    });
    // start
    if(this.start){
      if(this.first){
        this.first = false;
        this.world.onFirst();
      }
      else{
        //this.sound.play();
      }

    }
    // stop
    else{
      //this.sound.pause();
    }
  }
  //////////////////////////////////////////////////////////
  createWorld(){
    this.world = new World();
    this.world.createScene();

    // space bar
    document.body.addEventListener("keydown",this.keydown.bind(this));

    // start broadcast interval
    this.broadcastState();

    //this.controls = new THREE.TmpControls(this., this.renderer.domElement);
    //this.controls = TrackballControls( this., this.renderer.domElement );
    this.controls = new THREE.FirstPersonControls(this.world.camera, this.world.renderer.domElement);
    this.controls.activeLook = true;
    this.controls.movementSpeed = config.speed;

    // this.controls.constrainVertical = true;
    //this.controls.mouseDrageOn = true;
    //this.controls.lookSpeed = 0.002; // def= 0.005
    // //this.controls.verticalMax = 0.001;
    // this.controls.verticalMin = 0.1;

    //this.controls = new THREE.PointerLockControls(this., this.renderer.domElement);
    //this.controls.connect();

    // fly controls
    //var flyControls = new THREE.FlyControls(this., document.body);
    // this.controls.movementSpeed = 0.001;
    // //this.controls.domElement = document.querySelector("#WebGL-output");
    // //this.controls.domElement = document.body;
    // //this.controls.rollSpeed = Math.PI / 92 ; 0.005
    // this.controls.rollSpeed = 0.01;

    // this.controls.autoForward = true;
    // this.controls.dragToLook = true;

    ///////////////////////////
    // 2d
    this.labelRenderer = new THREE.CSS2DRenderer();
    this.labelRenderer.setSize( window.innerWidth, window.innerHeight );
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = 0; // IMPORTANT FOR SCROLL
    // this.labelRenderer.domElement.style.border = "10px solid white";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    document.body.appendChild( this.labelRenderer.domElement );

  }
  //////////////////////////////////////////////////////////
  broadcastState(){
    let cam = this.world.camera;
    let direction = new THREE.Vector3();

    setInterval(()=>{
      // conditions
      if(this.exploding){
        return;
      }

      // gatePass
      const gatePass = this.world.checkGatePass();
      if(gatePass){
        console.log('gatePass!', gatePass.name);
        this.gatePassing = true;
        return;
      }

      // collision detection
      if(this.exploding = this.world.checkColission()){
        this.startStop(); // STOP!
        this.world.doExplode();
        this.world.returnToStart(()=>{
          this.exploding = false;
        })
        return;
      }

      // broadcast position
      cam.getWorldDirection(direction);
      deepStream.sendEvent('player',{
        type:"pos",
        pos:cam.position,
        dir:direction
      });

    }, 500);
  }
  //////////////////////////////////////////////////////////
  keydown(e){
    //e.preventDefault = true;
    switch(e.code){
      case "Space":{
       this.startStop();
      }
    }
    //return false;
  }
  //////////////////////////////////////////////////////////
  // render2dOverlay(){
  //   const c = this.renderer.domElement;
  //   var ctx = c.getContext("2d");
  //   if(ctx){
  //     ctx.beginPath();
  //     ctx.arc(100, 75, 50, 0, 2 * Math.PI);
  //     ctx.stroke();
  //   }
  // }
  //////////////////////////////////////////////////////////
  render(){
    // fly controls
    this.controls.update(1);

    // actual
    //this.renderer.render(this.scene, this.);
    this.world.render(this.labelRenderer);
  }
  //////////////////////////////////////////////////////////
  onresize(e){

    this.labelRenderer.domElement.style.width = window.innerWidth;
    this.labelRenderer.domElement.style.height = window.innerHeight;

	  this.aspect = window.innerWidth / window.innerHeight
    this.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    // for mouse
    // this.v2.x = ( e.clientX / window.innerWidth ) * 2 - 1;
	  // this.v2.y = - ( e.clientY / window.innerHeight ) * 2 + 1;

    this.controls.handleResize();
  }
}

const game = new Game();
window.onload = function(){

  game.loadAsync(()=>{
    game.createWorld();
    var fps = config.fps, fpsInterval, startTime, now, then, elapsed;

    function animate() {
      // request another frame
      requestAnimationFrame(animate);

      // calc elapsed time since last loop
      now = Date.now();
      elapsed = now - then;

      // if enough time has elapsed, draw the next frame
      if (elapsed > fpsInterval) {
          // Get ready for next frame by setting then=now, but also adjust for your
          // specified fpsInterval not being a multiple of RAF's interval (16.7ms)
          then = now - (elapsed % fpsInterval);
          // Put your drawing code here
          game.render();
      }
    }

    // start animating
    fpsInterval = 1000 / fps;
    then = Date.now();
    startTime = then;
    animate();
  });
}
window.onresize = game.onresize.bind(game);
