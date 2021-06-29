const BLUE = 0x000088;
const RED = 0x880000;
const SIZE = config.size;

class Game extends THREE.EventDispatcher {
  //////////////////////////////////////////////////////////
  constructor(){
    super();
    
    this.start = false;
    this.first = true;
    this.sound = new Sound();
    this.players = new Players(this);
    this.v2 = new THREE.Vector2(0, 2);
    
    //this.steering = new Steering();    
  }
  //////////////////////////////////////////////////////////
  loadAsync(cb){
    //load flag template
    this.flagObj = null;

    this.redFlag = new Flag(this, this.flagObj, RED);
    this.redFlag = new Flag(this, this.flagObj, BLUE);

    cb();
  }
  //////////////////////////////////////////////////////////
  startStop(){
    this.start = !this.start;
    this.controls.autoForward = this.start;
    deepStream.sendEvent('player',{
      type:"start",
      moving:this.start,
      pos:this.camera.position
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
  createCamera(){
    this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    
    // aim and dashboard
    // var cubeGeometry = new THREE.CircleGeometry(20, 100);
    // var cubeMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide, transparent: false, opacity: 0.5, depthTest: false});
    // var cube = new THREE.Mesh(cubeGeometry, cubeMaterial);    
    // this.camera.add(cube);
    // cube.position.set( 0, 0, -30 );
    //crosshair
    // const lineMaterial = new THREE.LineBasicMaterial({
    //   color: 0xffffff
    // });
    // var points = new Array();
    // points[0] = new THREE.Vector3(-.1, 0, 0);
    // points[1] = new THREE.Vector3(.1, 0, 0);
    // let lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    // const xLine = new THREE.Line(lineGeometry, lineMaterial);
    // this.camera.add(xLine);
    // points[0] = new THREE.Vector3(0, -.1, 0);
    // points[1] = new THREE.Vector3(0, .1, 0);
    // lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    // const yLine = new THREE.Line(lineGeometry, lineMaterial);
    // this.camera.add(yLine);
    // points[0] = new THREE.Vector3(0, 0, -.1);
    // points[1] = new THREE.Vector3(0, 0, .1);
    // lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    // const zLine = new THREE.Line(lineGeometry, lineMaterial);
    // this.camera.add(zLine);

    this.camera.position.y += 3.5 ;
    this.camera.position.z += SIZE;
  }
  //////////////////////////////////////////////////////////
  checkGatePass(){
  }
  //////////////////////////////////////////////////////////
  checkCollision(){
    const all = this.players.all()
    if(!all.length)
      return false;
      
    // update the picking ray with the camera and mouse position
	  this.raycaster.setFromCamera( this.v2, this.camera );

    // calculate objects intersecting the picking ray
    //const intersects = this.raycaster.intersectObjects( [this.redGate, this.blueGate] );
    const intersects = this.raycaster.intersectObjects( all );

    //for ( let i = 0; i < intersects.length; i ++ ) {
    if(intersects && intersects.length){
      console.log(intersects[ 0 ].object.id, intersects[ 0 ].object.name, intersects[ 0 ].distance );
    }
      //intersects[ i ].object.material.color.set( 0xffffff );
    //}
  }
  //////////////////////////////////////////////////////////
  createScene(){    
    this.scene = new THREE.Scene();

    this.createCamera();
    // for colision
    this.raycaster = new THREE.Raycaster();

    // helper for size
    const axesHelper = new THREE.AxesHelper( SIZE );
    this.scene.add( axesHelper );
    

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
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    this.scene.add(light);

    //this.player = new Vessel(this, this.camera);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( this.renderer.domElement );

    const divisions = 20;    
    // create red grid
    let grid = new THREE.GridHelper( SIZE, divisions, RED,RED );
    this.scene.add( grid );
    grid.position.z = -SIZE/2;
    // create blue grid
    grid = new THREE.GridHelper( SIZE, divisions, BLUE,BLUE );
    grid.position.z -= SIZE/2 + SIZE;
    // offset blue
    this.scene.add( grid );

    const GATE_SIZE = config.size / 20;

    // red gate
    this.redGate = this.createGate(RED, GATE_SIZE);
    this.redGate.name = "redGate";
    this.redGate.position.z = 0;
    // move front and up
    this.redGate.position.z -= 2*SIZE;
    this.redGate.position.y += GATE_SIZE;    
    this.scene.add( this.redGate );

    // blue gate
    this.blueGate = this.createGate(BLUE, GATE_SIZE);
    this.blueGate.name = "blueGate";
    // move back and up
    //this.blueGate.position.z += SIZE/2;
    this.blueGate.position.y += GATE_SIZE;    
    this.scene.add( this.blueGate );    

    
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
    let cam = this.camera;
    let direction = new THREE.Vector3();
    setInterval(()=>{
      this.checkCollision();
      this.checkGatePass();
      cam.getWorldDirection(direction);
      deepStream.sendEvent('player',{
        type:"pos",
        pos:cam.position,
        dir:direction
      });      
      //deepStream.sendPlayerState(cam.position, direction);
    }, 100);    
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

    // fly controls        
    this.controls.update(1);
    // players
    this.players.update();

    this.renderer.render(this.scene, this.camera);
  }
  //////////////////////////////////////////////////////////
  onresize(){
    this.midX = window.innerWidth / 2;
    this.midY = window.innerHeight / 2;

	  this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    
    this.controls.handleResize();
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


