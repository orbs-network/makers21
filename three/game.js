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
    this.loadLocalState()
  }
  //////////////////////////////////////////////////////////
  loadLocalState(){
    this.localState = {
      nick: localStorage.getItem("nick"),
      isRed: localStorage.getItem("isRed") || true
    }
  }
  //////////////////////////////////////////////////////////
  saveLocalState(){
    // and update
    this.localState.isRed = document.getElementById('red').getAttribute('checked') == "checked";
    for(let p in this.localState){
      localStorage.setItem(p, this.localState[p]);
    }
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
  checkJoined(){
    return this.mngrState.red.includes(this.localState.nick) || this.mngrState.blue.includes(this.localState.nick);
  }
  //////////////////////////////////////////////////////////
  onJoinLeave(){
    // current status
    console.log('onJoinLeave current isJoined=', this.isJoined);
    // send join to server
    const type = this.isJoined? "leave" : "join";

    deepStream.sendEvent('player',{
      type:type,
      isRed: this.localState.isRed,
      nick: this.localState.nick
    });
    console.log(`request ${type}`)
  }
  //////////////////////////////////////////////////////////
  uxInit(){
    // handler for join
    document.getElementById("join").addEventListener("click",this.onJoinLeave.bind(this));
    // UI events
    document.getElementById("nick").addEventListener("input",(e)=>{
      // show/hide chose team
      document.getElementById("choose-team").style.display = (e.target.value.length > 2)? 'block':'none';
      if(e.target.value.length > 2){
        localState.nick = e.target.value;
        this.saveLocalState();
      }
    });
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
  begin(){
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
  }
  //////////////////////////////////////////////////////////
  setInputs(){
    document.getElementById('red').setAttribute('checked', this.localState.isRed);
    document.getElementById('blue').setAttribute('checked', !this.localState.isRed);
    document.getElementById('nick').setAttribute('value', this.localState.nick? this.localState.nick:'');
    // show chose only if text is filled
    let display = (this.localState.nick.length > 2)? 'block':'none';
    const choose = document.getElementById("choose-team");
    choose.style.display = display;
  }
  //////////////////////////////////////////////////////////
  onMngrState(state){
    // store
    this.mngrState = state;

    // stop reconnect
    if(this.tidConnect){
      clearTimeout(this.tidConnect);
      this.tidConnect = null;
    }

    // online status
    document.getElementById('online').innerText = "connected!";
    // update status
    if(state.started){
      // started
      document.getElementById('started').innerText = "game has started - please wait for next game to start";
    }
    else{
      //pending
      document.getElementById('started').innerText = "game is pending";
      if(state.ready){
        // ready to start
        document.getElementById('ready').innerText = "ready to start";
      }
      else{
        // waiting for atleast 2 players
        document.getElementById('ready').innerText = "waiting for more players to join";
      }
    }

    // TODO: check if already joined
    this.isJoined = this.checkJoined();

    // display inputs
    const display =  !state.ready && !this.isJoined;
    document.getElementById('inputs').style.display = display ? "block" : "none";
    this.setInputs();
    console.log(state);
  }
  //////////////////////////////////////////////////////////
  onEvent(data){
    console.log('onEvent manager', data);
    switch(data.type){
      case "state":
        this.onMngrState(data.state);
        break;
    }
  }
  //////////////////////////////////////////////////////////
  onOffline(){
    clearTimeout(this.tidConnect);
    document.getElementById('online').innerText = "could not connect, please reload to retry";
    this.tidConnect = null;
  }
  //////////////////////////////////////////////////////////
  connect(){
    document.getElementById('online').innerText = "connecting...";
    // send join - receieve state
    deepStream.subscribe('mngr', this.onEvent.bind(this));
    // broadcast online for 3 seconds
    // to get response with state from server
    let count = 0;
    let interval = 300;
    this.tidConnect = setInterval(()=>{
      if(count++ >= 3*1000/interval ){
        return this.onOffline();
      }
      deepStream.sendEvent('player',{
        type:"online"
      });
    },interval);
  }
  //////////////////////////////////////////////////////////
  createWorld(){
    this.world = new World();
    this.world.createScene();

    // space bar
    document.body.addEventListener("keydown",this.keydown.bind(this));


    ///////////////////////////
    // 2d
    this.labelRenderer = new THREE.CSS2DRenderer();
    this.labelRenderer.setSize( window.innerWidth, window.innerHeight );
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = 0; // IMPORTANT FOR SCROLL
    // this.labelRenderer.domElement.style.border = "10px solid white";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    document.body.appendChild( this.labelRenderer.domElement );

    this.connect();
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
    if(this.controls){
      this.controls.update(1);
    }

    // actual
    //this.renderer.render(this.scene, this.);
    this.world.render(this.labelRenderer);
  }
  //////////////////////////////////////////////////////////
  onresize(e){

    this.labelRenderer.domElement.style.width = window.innerWidth;
    this.labelRenderer.domElement.style.height = window.innerHeight;

	  this.aspect = window.innerWidth / window.innerHeight
    this.world.camera.updateProjectionMatrix();
    //this.updateProjectionMatrix()
    this.world.renderer.setSize(window.innerWidth, window.innerHeight)

    // for mouse
    // this.v2.x = ( e.clientX / window.innerWidth ) * 2 - 1;
	  // this.v2.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
    if(this.controls){
      this.controls.handleResize();
    }
  }
}
//////////////////////////////////////////////////////////
const game = new Game();
window.onload = function(){
  game.loadAsync(()=>{
    game.uxInit();
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
