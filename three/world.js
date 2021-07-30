class World {
  //////////////////////////////////////////////////////////
  constructor(){
    this.border = {};
    this.flags = new Flags();
    this.worldPos = new THREE.Vector3();
    this.worldDir = new THREE.Vector3();
  }
  //////////////////////////////////////////////////////////
  createScene(){
    this.scene = new THREE.Scene();
    this.explode = new ExplodeMngr(this.scene);

    this.createCamera();

    // for colision
    this.raycaster = new THREE.Raycaster();

    // helper for size
    // const axesHelper = new THREE.AxesHelper( SIZE );
    // this.scene.add( axesHelper );

    ///////////////////////////////
    // Light
    const skyColor = 0xB1E1FF;  // light blue
    const groundColor = 0xB97A20;  // brownish orange
    const intensity = 1;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    this.scene.add(light);

    this._renderer = new THREE.WebGLRenderer();
    this._renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( this._renderer.domElement );

    // create red+blue borders & ceeling
    this.createBorders(RED, 1);
    this.createBorders(BLUE, -1);

    // GATES
    const GATE_SIZE = config.size / 20;
    // red gate
    this.redGate = this.createGate(RED2, GATE_SIZE);
    this.redGate.name = "redGate";

    // move front and up
    this.redGate.position.z = -SIZE;
    this.redGate.position.y = SIZE/2 - 2*GATE_SIZE;
    this.scene.add( this.redGate );
    // pass
    this.redGate.passSphere = new THREE.Sphere(this.redGate.position, GATE_SIZE/1.5);

    // blue gate
    this.blueGate = this.createGate(BLUE2, GATE_SIZE);
    this.blueGate.name = "blueGate";

    // move back and up
    this.blueGate.position.z = SIZE;
    this.blueGate.position.y = SIZE/2 - 2*GATE_SIZE;
    this.scene.add( this.blueGate );
    // pass
    this.blueGate.passSphere = new THREE.Sphere(this.blueGate.position, GATE_SIZE/1.5);

    // Flags
    this.flags.createFlag(this.blueGate, 'RED-FLAG', 0xFF0000, .003);
    this.flags.createFlag(this.redGate, 'BLUE-FLAG', 0x0000FF, .003);

    // create players
    this.players = new Players(this);

    // sound
    //init from user ket down in game this.initSound();
  }
  //////////////////////////////////////////////////////////
  createBorderPad(divisions, zDir, zPosFactor, xDir, xPosFactor, yPos){
    let grid = new THREE.GridHelper( SIZE/2, divisions/2, GREY, GREY );
    this.scene.add( grid );
    grid.position.z = SIZE *zPosFactor * zDir;
    grid.position.x -= SIZE * xPosFactor * xDir;
    grid.position.y = yPos;
  }
  createBorderPads(divisions, zDir, xDir, yPos){
    // creae pads left
    let zPosFactor = 0.25;
    let xPosFactor = 0.75;
    // side
    this.createBorderPad(divisions, zDir, zPosFactor, xDir, xPosFactor, yPos);
    zPosFactor = 0.75;
    this.createBorderPad(divisions, zDir, zPosFactor, xDir, xPosFactor, yPos);
    zPosFactor = 1.25;
    this.createBorderPad(divisions, zDir, zPosFactor, xDir, xPosFactor, yPos);
    // end
    xPosFactor = -0.25;
    this.createBorderPad(divisions, zDir, zPosFactor, xDir, xPosFactor, yPos);
  }
  //////////////////////////////////////////////////////////
  createHoriz(divisions, color, zDir, yPos){
    let zOffset = SIZE/2 * zDir + zDir *0.01;// little space to avoid overlap
    // create floor
    let grid = new THREE.GridHelper( SIZE, divisions, color, color );
    this.scene.add( grid );
    grid.position.z = zOffset;
    grid.position.y = yPos;


    // create pads
    this.createBorderPads(divisions, zDir, 1, yPos);
    this.createBorderPads(divisions, zDir, -1, yPos);
  }
  //////////////////////////////////////////////////////////
  createBorders(color, zDir){
    const divisions = 30;
    // create floor
    this.border.floor = 0;
    this.createHoriz(divisions, color, zDir, this.border.floor);

    // create ceiling
    this.border.ceiling = SIZE;
    this.createHoriz(divisions, color, zDir, this.border.ceiling);

    this.border.north =  -SIZE * 1.5;
    this.border.south = SIZE * 1.5;
  }
  //////////////////////////////////////////////////////////
  createGate(color, GATE_SIZE){
    //const geometry = new THREE.TorusGeometry( GATE_SIZE, GATE_SIZE/3, 32, 16 );
    let geometry = new THREE.TorusGeometry( GATE_SIZE, GATE_SIZE/3, 32, 8 );
    // red gate
    // NOT WORKING WITH RAYCAST! let material = new THREE.LineBasicMaterial({color: color /*side: THREE.DoubleSide*/  });
    let material = new THREE.MeshBasicMaterial({color: color /*side: THREE.DoubleSide*/  });
    let gate = new THREE.Mesh( geometry, material );

    // add internal sphere for gate pass calc
    geometry = new THREE.SphereGeometry( GATE_SIZE/1.5, 16, 16 );
    const sColor = color === RED2? 0xFF0000 : 0x0000FF;
    material = new THREE.MeshBasicMaterial( {color: sColor, side: THREE.DoubleSide, transparent: true, opacity: 0.2} );
    const sphere = new THREE.Mesh( geometry, material );
    sphere.name = 'gatePass';
    gate.add( sphere );

    return gate;
  }
  //////////////////////////////////////////////////////////
  initSound(){
    this.sound = new Sound(this._camera);
    this.sound.add('gate.wav', this.redGate, true);
    this.sound.add('gate.wav', this.blueGate, true);

    this.players.initSound(this.sound);
    //this.explode.initSound(this.sound);

    // add explode sound to camera
    const loop = false;
    const vol = 0.3; // self not loudest
    this.sound.add('explode.wav', this._camera, loop, config.size, vol);
  }
  //////////////////////////////////////////////////////////
  onFirst(){
    this.initSound();
    let sound = this.redGate.getObjectByName('sound_gate.wav');
    if(sound) sound.play();
    sound = this.blueGate.getObjectByName('sound_gate.wav');
    if(sound) sound.play();
  }
  //////////////////////////////////////////////////////////
  createCamera(){
    this._camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

    // aim and dashboard
    // var cubeGeometry = new THREE.CircleGeometry( 0.2, 32);
    // var cubeMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide, transparent: false, opacity: 0.5, depthTest: false});
    // var cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    // this._camera.add(cube);
    // cube.position.set( 0, 0, -30 );
    this.scene.add(this._camera); //TODO: resume
    // this._cameraAim = cube;

    // /// line for raycasting
    // // Draw a line from pointA in the given direction at distance 100
    // var pointA = new THREE.Vector3( 0, 0, 0 );
    // var direction = new THREE.Vector3( 10, 0, 0 );
    // direction.normalize();

    // var distance = 100; // at what distance to determine pointB

    // var pointB = new THREE.Vector3();
    // pointB.addVectors ( pointA, direction.multiplyScalar( distance ) );

    // var geometry = new THREE.BufferGeometry();
    // const positions = new Float32Array( 2 );
    // geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 2 ) );
    // // geometry.vertices.push( pointA );
    // let index = 0;
    // positions[ index++ ] = pointA.x;
    // positions[ index++ ] = pointA.y;
    // positions[ index++ ] = pointA.z;
    // positions[ index++ ] = pointB.x;
    // positions[ index++ ] = pointB.y;
    // positions[ index++ ] = pointB.z;

    // // geometry.vertices.push( pointB );
    // var material = new THREE.LineBasicMaterial( { color : 0xff0000 } );
    // var line = new THREE.Line( geometry, material );
    // this.scene.add( line );

    //crosshair
    // const lineMaterial = new THREE.LineBasicMaterial({
    //   color: 0xffffff
    // });
    // var points = new Array();
    // points[0] = new THREE.Vector3(-.1, 0, 0);
    // points[1] = new THREE.Vector3(.1, 0, 0);
    // let lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    // const xLine = new THREE.Line(lineGeometry, lineMaterial);
    // this._camera.add(xLine);
    // points[0] = new THREE.Vector3(0, -.1, 0);
    // points[1] = new THREE.Vector3(0, .1, 0);
    // lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    // const yLine = new THREE.Line(lineGeometry, lineMaterial);
    // this._camera.add(yLine);
    // points[0] = new THREE.Vector3(0, 0, -.1);
    // points[1] = new THREE.Vector3(0, 0, .1);
    // lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    // const zLine = new THREE.Line(lineGeometry, lineMaterial);
    // this._camera.add(zLine);

    this._camera.position.y = SIZE/2 ;
    //this._camera.position.z += SIZE/2;
    //this._camera.position.z += SIZE;
    this.startLineZ = this._camera.position.z;
    this.startLineY = this._camera.position.y;
  }
  //////////////////////////////////////////////////////////
  checkGatePass(){
    if(this.redGate.passSphere.containsPoint(this._camera.position))      return this.redGate;
    if(this.blueGate.passSphere.containsPoint(this._camera.position))     return this.blueGate;
    return null
  }
  //////////////////////////////////////////////////////////
  checkColission(){
    // check colission other players
    // var camBox = new THREE.Box3().setFromObject( this._camera );
    // var players = this.players.all();
    // for(let p of players){
    //   if (isIntersecting(camBox, p)){
    //     console.log('collision other player: '+p.name);
    //     return true;
    //   }
    // }

    // Y axis
    if(this._camera.position.y < this.border.floor) return true;
    if(this._camera.position.y > this.border.ceiling) return true;
    // z axis
    if(this._camera.position.z < this.border.north) return true;
    if(this._camera.position.z > this.border.south) return true;

    //var collision = camBox.containsPoint( camera.position );
    if(this.checkColissionGate()){
      console.log('Gate Colision!');
      return true;
    }
  }
  ////////////////////////////////////////////////////////
  checkColissionGate(){
    // update the picking ray with the camera and mouse position
	  //this.raycaster.setFromCamera( this.v2, this._camera );
    this._camera.getWorldPosition(this.worldPos);
    this._camera.getWorldDirection(this.worldDir);
    this.raycaster.set(this.worldPos, this.worldDir );

    // const dis = this.raycaster.ray.origin.distanceTo( this.blueGate.position );
    // console.log('distance = ',dis);
    // return ;

    // calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObjects( [this.redGate, this.blueGate] );
    //const intersects = this.raycaster.intersectObject( this.blueGate );

    if(intersects && intersects.length){
      console.log(intersects.length, intersects[0].distance);
      // for(let i of intersects){
      if (intersects[0].distance < 1){
        return true;
      }

      //   }
      // }
    }
    // const recursive = false;
    // const intersects = this.raycaster.intersectObject( this.blueGate, recursive );
    //const intersects = this.raycaster.intersectObjects( all );

    //for ( let i = 0; i < intersects.length; i ++ ) {
    // if(intersects && intersects.length){
    //   if (intersects[ 0 ].distance < 0.001){
    //     console.log('raycast', intersects[ 0 ].object.id, intersects[ 0 ].object.name, intersects[ 0 ].distance, intersects[ 0 ].face, intersects[ 0 ].faceIndex );
    //     console.log(intersects[0]);
    //     return true;
    //   }
    // }
    return false;
      //intersects[ i ].object.material.color.set( 0xffffff );
    //}
  }
  //////////////////////////////////////////////////////////
  doExplode(){
    this.explode.create(this._camera.position.x, this._camera.position.y, this._camera.position.z );
    let sound = this._camera.getObjectByName('sound_explode.wav');
    if(sound) sound.play();
  }
  //////////////////////////////////////////////////////////
  // set this player's team
  setNick(nick){
    this.players.setNick(nick);
  }
  //////////////////////////////////////////////////////////
  // set this player's team
  setTeam(isRed){
    // no team - look from the side
    if(isRed == null){
      this._camera.position.z = 0;
      this._camera.position.x = 0;
      return;
    }

    this.startLineZ = SIZE * (isRed? 1.5 : -1.5);
    this._camera.position.z = this.startLineZ
    this._camera.rotation.y = isRed? 0 : Math.PI * (360 / 360);
    //this._camera.lookAt(isRed? this.redGate : this.blueGate);
  }
  //////////////////////////////////////////////////////////
  // set other players teams
  setPlayerTeams(red, blue){
    this.players.setTeams(red, blue);
  }
  //////////////////////////////////////////////////////////
  returnToStart(cb){
    const tid = setInterval(()=>{
      let zDiff = this.startLineZ - this._camera.position.z ;
      let yDiff = this.startLineY - this._camera.position.y ;
      //console.log('returnToStart zDiff', zDiff);
      if(Math.abs(zDiff) <= 0.1){
        console.log('DONE!', zDiff);
        this._camera.position.z = this.startLineZ;
        this._camera.position.y = this.startLineY;
        clearTimeout(tid);
        return cb();
      }
      zDiff *= 0.05;
      yDiff *= 0.05;
      this._camera.position.z += zDiff;
      this._camera.position.y += yDiff;
      //this._camera.lookAt(this.redGate);
    },30);

  }
  //////////////////////////////////////////////////////////
  get camera(){
    return this._camera;
  }
  //////////////////////////////////////////////////////////
  get renderer(){
    return this._renderer;
  }
  //////////////////////////////////////////////////////////
  resetGateRotation(){
    this.redGate.rotation.y = 0;
    this.blueGate.rotation.y = 0;
  }
  //////////////////////////////////////////////////////////
  render(labelRenderer){
    // rotate gates
    this.redGate.rotateY(config.gateSpeed);// rotation.y -= config.gateSpeed;
    this.blueGate.rotateY(-config.gateSpeed);// rotation.y += config.gateSpeed;

    // players
    this.players.update();
    // explosions
    this.explode.beforeRender();

    this._renderer.render(this.scene, this._camera);
    labelRenderer.render(this.scene, this._camera);
  }
}