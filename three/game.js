class Game /*extends THREE.EventDispatcher*/ {
  //////////////////////////////////////////////////////////
  constructor(){
    this.resetMembers();
    this.loadLocalState();
  }
  //////////////////////////////////////////////////////////
  resetMembers(){
    this.moving = false;
    this.first = true;
    this.exploding = false;
    this.holdingFlag = false;
    this.passingGate = null;
    this.gameOver = false;
    // NEED THIS! this.mngrState = null;
  }
  //////////////////////////////////////////////////////////
  loadLocalState(){
    this.localState = {
      nick: localStorage.getItem("nick"),
      isRed: localStorage.getItem("isRed") === "true" // fix string
    }
  }
  //////////////////////////////////////////////////////////
  saveLocalState(){
    // update localState
    this.localState.isRed = document.getElementById('red').checked;
    // ALREADY SET DURING EVENTS this.localState.nick = document.getElementById('nick').getAttribute('value');
    // and save to storage
    for(let p in this.localState){
      localStorage.setItem(p, this.localState[p]);
    }
  }
  //////////////////////////////////////////////////////////
  loadAsync(cb){
    this.world.loadModels(cb);
  }
  //////////////////////////////////////////////////////////
  isJoined(){
    return this.mngrState.red.includes(this.localState.nick) || this.mngrState.blue.includes(this.localState.nick);
  }
  //////////////////////////////////////////////////////////
  onError(error){
    console.error(error);
    alert(error);
  }
  //////////////////////////////////////////////////////////
  // oposite to on game start
  resetAll(){
    console.log('reset ALL');
    this.resetMembers();

    // update world
    this.world.setNick(this.localState.nick);
    this.world.setTeamPos(null);
    this.world._camera.rotation.set(0,0,0);
    this.controls.lookAt(this.world.redGate.position);

    this.world.resetGateRotation();

    // 321 stop if in middle
    if(this.tid321){
      clearInterval(this.tid321);
      this.tid321 = null;
    }

    // handle Flags
    this.world.setFlagHolders(this.holdingFlag, this.localState, this.mngrState);
    this.world.reset();

    // init controls
    this.initControls(false);
    // start broadcast interval
    this.startUpdateLoop(false);
    // to enable start stop
    this.setGameMsg('game has been reset!');
  }
  //////////////////////////////////////////////////////////
  onJoin(){
    const _this = this;
    // save current local state
    this.saveLocalState();
    deepStream.client.rpc.make('client',{
      type:"join",
      isRed: this.localState.isRed,
      nick: this.localState.nick
    },(error,result) => {
      if(error){
        _this.onError(error);
        return;
      }
      if(result!='ok'){
        this.setGameMsg('join: '+result);
      }
    });
    // update world
    this.world.setNick(this.localState.nick);
    this.world.setTeamPos(this.localState.isRed);
  }
  //////////////////////////////////////////////////////////
  onLeave(){
    // save current local state
    const _this = this;
    this.saveLocalState();
    deepStream.client.rpc.make('client',{
      type:"leave",
      isRed: this.localState.isRed,
      nick: this.localState.nick
    },(error,result) => {
      if(error){
        _this.onError(error);
        return;
      }
      if(result!='ok'){
        alert('leave: '+result);
      }
    });
  }
  //////////////////////////////////////////////////////////
  onStart(){
    //this.ping.play();
    document.getElementById("req-start").style.display = 'block';
    deepStream.client.rpc.make( 'client', {type:'start', nick:this.localState.nick}, (error, result) => {
      if(error){
        console.error(error);
        return;
      }
      //this.onMngrState(result.state);
    });
  }
  //////////////////////////////////////////////////////////
  onReset(){
    deepStream.client.rpc.make( 'client', {type:'reset', nick:this.localState.nick}, (error, result) => {
      if(error){
        console.error('reset',error);
        return;
      }
    });
  }
  //////////////////////////////////////////////////////////
  uxInit(){
    // handler for join
    document.getElementById('join').addEventListener('click',this.onJoin.bind(this));
    document.getElementById('leave').addEventListener('click',this.onLeave.bind(this));
    document.getElementById('start').addEventListener('click',this.onStart.bind(this));
    document.getElementById('reset').addEventListener('click',this.onReset.bind(this));

    // [press any key to start]
    document.body.addEventListener("keydown",this.keydown.bind(this));

    // UI events
    document.getElementById('nick').addEventListener('input',(e)=>{
      // show/hide chose team
      document.getElementById('choose-team').style.display = (e.target.value.length > 2)? 'block':'none';
      if(e.target.value.length > 2){
        this.localState.nick = e.target.value;
        this.saveLocalState();
      }
    });
    // radio buttons and nick
    this.setInputs();
  }
  //////////////////////////////////////////////////////////
  startStop(){
    if(!this.moving && this.exploding){
      this.playAudio('wrong');
      console.log('cant start while exploding')
      return;
    }

	if (!this.controls) {
		return
	}

    this.moving = !this.moving;
    this.controls.autoForward = this.moving;
    this.controls.enabled = this.moving;
    let pos = this.world.camera.position;
    deepStream.sendEvent('player',{
      type:"start",
      moving:this.moving,
      pos:pos,
      nick:this.localState.nick
    });
    // start
    if(this.moving){
      if(this.first){
        this.first = false;
        //this.world.onFirst();
      }
      this.world.sound.play();
    }
    // stop
    else{
      this.world.sound.pause();
    }
  }
  //////////////////////////////////////////////////////////
  onblur(){
    if(this.moving && !localStorage.getItem('debug')=="true"){
      this.startStop();
    }
  };
  //////////////////////////////////////////////////////////
  initControls(init){
    if(!this.controls){
      this.controls = new THREE.FirstPersonControls(this.world.camera, this.world.renderer.domElement);
      this.controls.activeLook = true;
      this.controls.movementSpeed = config.speed;
    }
    this.controls.enabled = init;
    //this.controls = new THREE.TmpControls(this., this.renderer.domElement);
    //this.controls = TrackballControls( this., this.renderer.domElement );


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
    // nick
    const nick = this.localState.nick? this.localState.nick:'';
    document.getElementById('nick').setAttribute('value', nick);
    // team radio
    document.getElementById('red').checked = this.localState.isRed// setAttribute('checked', this.localState.isRed);
    document.getElementById('blue').checked = !this.localState.isRed;//setAttribute('checked', !this.localState.isRed);
    // show chosose-team only if text is filled
    let display = (nick.length > 2)? 'block':'none';
    const choose = document.getElementById("choose-team");
    choose.style.display = display;
  }
  //////////////////////////////////////////////////////////
  setGameMsg(html){
    document.getElementById('msg').innerHTML = html;
  }
  //////////////////////////////////////////////////////////
  show321(){
    let sec = 0;
    this.playAudio('ping');
    this.tid321 = setInterval(() =>{
      const diff = this.mngrState.startTs - Date.now();
      if(diff < 0 ){
        if(this.tid321){
          clearInterval(this.tid321);
          this.tid321 = null;
        }
        // resume
        this.onGameStarted();
        return;
      }
      var seconds = parseInt(diff / 1000);
      var mili  = (new Date(diff)).getMilliseconds();
      this.setGameMsg(`GAME BEGINS IN ${seconds}:${mili}`);
      // ping
      sec +=1;
      if(!(sec % 15)){
        //this.ping.stop();
        this.playAudio('ping');
      }
    },100);
  }
  //////////////////////////////////////////////////////////
  onGameStarted(){
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('game-display').style.display = 'block';

    // either way update whos on ehich team
    this.world.setPlayerTeams(this.mngrState.red, this.mngrState.blue);

    // 3 2 1
    if(Date.now() < this.mngrState.startTs){
      // show countdown
      this.show321();
      //this.setGameMsg('game begins in:');
      return;
    }else{
      // update world
      this.world.setNick(this.localState.nick);
      this.world.setTeamPos(this.localState.isRed);

      this.world.resetGateRotation();

      // handle Flags
      this.holdingFlag = (this.localState.nick === this.mngrState.redHolder || this.localState.nick === this.mngrState.blueHolder);
      this.world.setFlagHolders(this.holdingFlag, this.localState, this.mngrState);

      // init controls
      this.initControls(false);
      // start broadcast interval
      this.startUpdateLoop(true);
      // to enable start stop
      this.setGameMsg('press any key to start flying!');
    }
  }
  //////////////////////////////////////////////////////////
  onGameOver(){
    document.getElementById('game-over').style.display = 'block';
    const winnerTeam = this.mngrState.winnerIsRed? 'red':'blue';
    document.getElementById('game-over').className = winnerTeam;
    document.getElementById('winnerNick').innerHTML = `${this.mngrState.winnerNick} has captured the flag!`;
    document.getElementById('winnerIsRed').innerHTML =`${winnerTeam} TEAM IS THE WINNER`;
    this.moving = false;
    this.startUpdateLoop(false);
  }
  //////////////////////////////////////////////////////////
  onMngrState(state){
    // store
    this.mngrState = state;

    // reset from mngr
    if(state.needReset){
      this.resetAll();
      document.getElementById('game-display').style.display = 'none';
      document.getElementById('req-start').style.display = 'none';
      document.getElementById('welcome').style.display = 'block';
    }

    const joined = this.isJoined()

    // online status
    document.getElementById('online').innerText = "connected!";

    //////////////////////////////////////////////////////////
    // game you have joined - is WON
    if(joined && state.winnerNick){
      this.onGameOver();
      return;
    }
    document.getElementById('game-over').style.display = 'none';

    //////////////////////////////////////////////////////////
    // game already started
    if(state.started){

      if(!joined) {
		document.getElementById('online').innerText = "observer!";
      	return;
	  }

      // first means hasnt moved, after reload
      if(joined && this.first){
        // return/start game
        this.onGameStarted();
      }else{
        // Ongoing game update (not first since reload)

        // Handle Flags
        this.holdingFlag = (this.localState.nick === this.mngrState.redHolder || this.localState.nick === this.mngrState.blueHolder);
        this.world.setFlagHolders(this.holdingFlag, this.localState, this.mngrState);

        document.getElementById('inputs').style.display = "none";
        document.getElementById('teams').style.display = "none";
        document.getElementById('started').innerText = "game has started - please wait for next game to start";
      }
      return;
    }

    // ready to start
    document.getElementById('ready-text').innerText = state.ready? "ready to start": "waiting for more players to join";

    // joined section - show/hide
    document.getElementById('inputs').style.display = "none";

    //////////////////////////////////////////////////////////
    // game pending  - show welcome
    document.getElementById('started').innerText = "game is pending";

    // update teams
    document.getElementById('red-team').innerHTML = state.red?.length? state.red?.join() : '0 players';
    document.getElementById('blue-team').innerHTML = state.blue?.length? state.blue?.join(): '0 players';
    // show teams
    document.getElementById('teams').style.display = "block";

    //////////////////////////////////////////////////////////
    // not joined - show joined
    document.getElementById('joined').style.display = joined? "block":"none";

    // show [start] only of ready and joined team
    document.getElementById('start').style.display = (state.ready && joined)? 'block':'none';

    if(!joined){
      document.getElementById('inputs').style.display = "block";
      // neutral
      this.world.setTeamPos(null);
      return;
    }
    // world team (on load after joined)
    this.world.setTeamPos(this.localState.isRed);

    //////////////////////////////////////////////////////////
    //joined
    // set nick "joined as"
    const team = this.localState.isRed? 'red':'blue';

    document.getElementById('nick-join').innerHTML = this.localState.nick;
    document.getElementById('nick-join').setAttribute('class', team);
    document.getElementById('team-join').innerHTML = team;
    document.getElementById('team-join').setAttribute('class', team);
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
    document.getElementById('online').innerText = "could not connect, please reload to retry";
    //alert('offline!!!');
    console.log('offline!!!');
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

    deepStream.client.rpc.make( 'client', {type:'online'}, (error, result) => {
      if(error){
        console.error(error);
        this.onOffline();
        return;
      }
      this.onMngrState(result.state);
    })
  }
  //////////////////////////////////////////////////////////
  createWorld(){
    this.world = new World();
  }
  //////////////////////////////////////////////////////////
  playAudio(id){
    if(!this.audio){
      this.audio = {};
    }
    if(!(id in this.audio )){
      this.audio[id] = document.getElementById(id);
    }
    if(this.audio[id]){
      this.audio[id].play()
    }
    else{
      console.error(`${id} is missing in audio`);
    }
  }
  //////////////////////////////////////////////////////////
  tellGatePass(winGate){
    deepStream.client.rpc.make('client',{
      type:"gatePass",
      isRed: this.localState.isRed,
      winGate:winGate,
      nick: this.localState.nick
    },(error,result) => {
      if(error){
        _this.onError(error);
        return;
      }
      if(result != 'ok'){
        this.setGameMsg('gatePass: '+result );
        this.playAudio('wrong');
        return;
      }else{
        this.holdingFlag = true;
        // SUCCESS - you are the holder of the flag
        this.playAudio('success');
      }
    });
  }
  //////////////////////////////////////////////////////////
  passInGate(gate){
    // team gate
    let _this = this;
    if(this.localState.isRed == (gate.name == "redGate")){
      console.log('collect gatePass!', gate.name);
      // tell mngr
      this.tellGatePass(false);
    }else{
      const team = this.localState.isRed?'red':'blue';
      // Game Won?
      if(this.holdingFlag){
        console.log('WIN - tell manager!!!!!!!!!!!!!!!!!')
        this.setGameMsg(`<span class="${team}">${team} TEAM</span> WINS thanks to you!`);
        this.playAudio('success');
        this.tellGatePass(true);
      }
      else{
        // My team's gate
        console.log('wrong gatePass!', gate.name);
        this.setGameMsg(`capture the <span class="${this.localState.isRed?'red':'blue'}">flag</span> before passing in <span class="${this.localState.isRed?'red':'blue'}> this gate</span> `);
        this.playAudio('wrong');
      }
    }
  }
  checkFlagDrop(){
    if(!this.holdingFlag){
      return;
    }
    //this.world.setFlagHolders(); - let mngr state take care of this

    deepStream.client.rpc.make('client',{
      type:"flagDrop",
      isRed: this.localState.isRed,
      nick: this.localState.nick
    },(error,result) => {
      if(error){
        _this.onError(error);
        return;
      }
      if(result!='ok'){
        this.setGameMsg('flagDrop: '+result);
      }
    });
  }
  //////////////////////////////////////////////////////////
  startUpdateLoop(start){
    // stop
    if(!start){
      if(this.updateLoopTID){
        clearInterval(this.updateLoopTID);
        this.updateLoopTID = 0;
      }
      return;
    }
    // start
    let cam = this.world.camera;
    let direction = new THREE.Vector3();

    this.updateLoopTID = setInterval(()=>{
      // conditions
      if(this.exploding){
        return;
      }
      if(!this.moving){
        return;
      }
      // broadcast position
      cam.getWorldDirection(direction);
      deepStream.sendEvent('player',{
        type:"pos",
        pos:cam.position,
        dir:direction,
        nick: this.localState.nick
      });

      if(this.gameOver){
        return;
      }

      // always check (even when passing to know if exited)
      const gate = this.world.checkGatePass();
      // enter gate pass
      if(!this.passingGate && gate){
        console.log(`enter ${gate.name}`);
        this.passingGate = gate;
        return; // avoid collision check
      }
      // exit of gate pass
      if(this.passingGate && !gate){
        console.log(`exit ${this.passingGate.name}`);
        this.passInGate(this.passingGate);
        this.passingGate = null;
        return; // avoid collision check
      }

      // collision detection
      if(this.exploding = this.world.checkColission()){
        this.startStop(); // STOP FLYING!
        this.world.doExplode();
        // look at oposite gate
        const gate = this.localState.isRed? this.world.redGate : this.world.blueGate;
        this.controls.lookAt(gate.position);
        // event explosion
        deepStream.sendEvent('player',{
          type:"explode",
          pos:cam.position,
          dir:direction,
          nick: this.localState.nick
        });
        // return flag if holders
        this.checkFlagDrop()
        // return to start
        this.world.returnToStart(()=>{
          this.controls.lookAt(gate.position);
          this.exploding = false;
        }, this.controls, gate);
        return;
      }

	  if (this.world.bordersAlarm()) {
		  // let sound = this.world._camera.getObjectByName('sound_explode.wav');
		  // let sound = this.world._camera.getObjectByName('sound_warning-alarm.mp3');
		  // console.log(`sound =${sound}`)
		  // if(sound) sound.play();
		  this.playAudio('warning-alarm')
	  }
	  // } else {
		//   let sound = this.world._camera.getObjectByName('sound_warning-alarm.mp3');
	  // 	  sound.pause();
	  // }

    }, 250);
  }
  //////////////////////////////////////////////////////////
  keydown(e){
    // not started
    if(!this.mngrState.started){
      console.log("cant fly before game started");
      return;
    }

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

    this.world.render();
  }
  //////////////////////////////////////////////////////////
  onresize(e){
    this.world.onresize(e);

    // for mouse
    // this.v2.x = ( e.clientX / window.innerWidth ) * 2 - 1;
	  // this.v2.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
    if(this.controls){
      this.controls.handleResize(e);
    }
  }
}
//////////////////////////////////////////////////////////
const game = new Game();
window.onload = function(){
  game.createWorld();
  game.loadAsync(()=>{
    console.log('All models have been loaded');
    game.uxInit();
    //game.createWorld();
    game.world.createScene();
    game.connect();
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
//window.onfocus = game.onfocus.bind(game);
window.onblur = game.onblur.bind(game);
