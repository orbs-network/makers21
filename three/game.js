const BLUE = 0x000088;
const RED = 0x880000;
const WHITE = 0xFFFFFF;


class Game extends THREE.EventDispatcher {
  //////////////////////////////////////////////////////////
  constructor(){
    super();

    this.start = false;
    this.first = true;
    this.sound = new Sound();
    this.players = new Players(this);

    this.flags = new Flags();

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
      pos:World.player.position
    });
    // start
    if(this.start){
      if(this.first){
        this.sound.add('gate.wav', this.redGate);
        this.sound.add('gate.wav', this.blueGate);
        this.first = false;
      }
      else{
        this.sound.play();
      }

    }
    // stop
    else{
      this.sound.pause();
    }

  }



  //////////////////////////////////////////////////////////
  createScene(){
    const SIZE = config.size;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

    World.player =  new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({color: 0x0000ff, transparent: true, opacity: 0.5})
    )

    World.player.camera = this.camera

    this.camera.position.y += 3.5 ;
    this.camera.position.z += SIZE;

    this.camera.add(
        World.player
    )

    // add light ???
    // const light = new THREE.DirectionalLight( 0xFFFFFF );
    // const helper = new THREE.DirectionalLightHelper( light, 5 );
    // this.scene.add( helper );

    // const color = 0xFFFFFF;
    // const intensity = 1;
    // const light = new THREE.AmbientLight(color, intensity);
    // this.scene.add(light);

    const skyColor = 0xB1E1FF;  // light blue
    const groundColor = 0xB97A20;  // brownish orange
    const intensity = 1;
    const light = new THREE.HemisphereLight(skyColor, 0xFFFFFF, intensity);
    this.scene.add(light);

    //this.player = new Vessel(this, this.camera);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( this.renderer.domElement );

    this.labelRenderer = new window.CSS2DRenderer();
    this.labelRenderer.setSize( window.innerWidth, window.innerHeight );
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0px';
    document.body.appendChild( this.labelRenderer.domElement );
    this.labelRenderer.domElement.style.pointerEvents = "none";

    const divisions = 20;

    const groundBoundingBox = Factory.physics.generateBoundingBox(
        SIZE, 0.1, SIZE *2
    )

    groundBoundingBox.position.z = -SIZE;

    // create red grid
    let grid = new THREE.GridHelper( SIZE, divisions, RED,RED );
    grid.position.z =  -SIZE/2 + SIZE;
    groundBoundingBox.add(grid)

    // create blue grid
    grid = new THREE.GridHelper( SIZE, divisions, BLUE,BLUE );
    grid.position.z = -SIZE/2;
    // offset blue
    groundBoundingBox.add(grid)

    this.scene.add(groundBoundingBox);

    World.ground = groundBoundingBox

    const GATE_SIZE = config.size / 20;

    // red gate
    this.redGate = this.createGate(RED, GATE_SIZE);

    this.redGate.position.z = 0;
    // move front and up
    this.redGate.position.z -= 2*SIZE;
    this.redGate.position.y += GATE_SIZE;
    this.scene.add( this.redGate );

    // blue gate
    this.blueGate = this.createGate(BLUE, GATE_SIZE);

    // move back and up
    //this.blueGate.position.z += SIZE/2;
    this.blueGate.position.y += GATE_SIZE;
    this.scene.add( this.blueGate );

    // this.flags.createFlag(this.scene, 'RED-FLAG', .003, {'x': 0, 'y': 0, 'z': -1});
	  console.log(this.redGate.position);
	  console.log(this.blueGate.position);

    this.flags.createFlag(this.scene, 'RED-FLAG', WHITE, .003, this.redGate.position);
    this.flags.createFlag(this.scene, 'BLUE-FLAG', WHITE, .003, this.blueGate.position);

    //this.controls = new THREE.TmpControls(this.camera, this.renderer.domElement);    
    this.controls = new THREE.FirstPersonControls(this.camera, this.renderer.domElement);
    this.controls.activeLook = true;
    // this.controls.constrainVertical = true;
    this.controls.mouseDrageOn = true;
    this.controls.movementSpeed = config.speed;
    // //this.controls.verticalMax = 0.001;
    // this.controls.verticalMin = 0.1;

    //this.controls = new THREE.PointerLockControls(this.camera, this.renderer.domElement);
    //this.controls.connect();

    // fly controls
    //var flyControls = new THREE.FlyControls(this.camera, document.body);
    // this.controls.movementSpeed = 0.001;
    // //this.controls.domElement = document.querySelector("#WebGL-output");
    // //this.controls.domElement = document.body;
    // //this.controls.rollSpeed = Math.PI / 92 ; 0.005
    // this.controls.rollSpeed = 0.01;

    // this.controls.autoForward = true;
    // this.controls.dragToLook = true;

    // create dummy player
    this.players.getPlayer("dummy");


    // space bar
    document.body.addEventListener("keydown",this.keydown.bind(this));

    // update server
    let direction = new THREE.Vector3();
    setInterval(()=>{
      this.camera.getWorldDirection(direction);
      deepStream.sendEvent('player',{
        type:"pos",
        pos:this.camera.position,
        dir:direction
      });
      //deepStream.sendPlayerState(cam.position, direction);
    }, 100)

  }
  keydown(e){
    switch(e.code){
      case "Space":{
       this.startStop();
      }
    }
  }
  createGate(color, GATE_SIZE){
    const geometry = new THREE.TorusGeometry( GATE_SIZE, GATE_SIZE/3, 32, 16 );
    // red gate
    let material = new THREE.LineBasicMaterial({ color: color });
    let gate = new THREE.Line( geometry, material );
    return gate;
  }

  //////////////////////////////////////////////////////////
  render(){

    // rotate gates
    this.blueGate.rotation.y += config.gateSpeed;
    this.redGate.rotation.y -= config.gateSpeed;

    this.dispatchEvent( { type: 'tick'} );

    this.update()

    // fly controls
    this.controls.update(1);

    // players
    this.players.update();

    this.renderer.render(this.scene, this.camera);
    
    this.labelRenderer.render(this.scene, this.camera);
  }
  //////////////////////////////////////////////////////////
  onresize(){

    this.labelRenderer.setSize(window.innerWidth, window.innerHeight)

    this.controls.handleResize();
  }

  update(){

      const collision = Physics.isIntersecting(
          World.player,
          World.ground
      )

      if (collision) {

          StateManager.crash()

      }


  }

}

const game = new Game();

window.onload = function(){

game.loadAsync(()=>{
  game.createScene();   
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
