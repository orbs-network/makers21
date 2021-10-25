class Game /*extends THREE.EventDispatcher*/ {
  //////////////////////////////////////////////////////////
  constructor(){
    this.resetMembers();
    this.loadLocalState();
    this.useNeck = localStorage.getItem('disableNeck') != 'true';
    this.stillTargetEnabled = localStorage.getItem('stillTargetEnabled') == 'true';
    this.disableConstantSpeed = localStorage.getItem("disableConstantSpeed") == 'true';
    this.disableSound = localStorage.getItem("disableSound");
  }
  //////////////////////////////////////////////////////////
  resetMembers(){
    this.moving = false;
    this.first = true;
    this.exploding = false;
    this.holdingFlag = false;
    this.passingGate = null;
    this.gameOver = false;
    this.targetPos = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.tsRender = Date.now();
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
  loadNeck(cb){
    if(!this.useNeck){
      return cb();
    }
    this.face = new Face();
    this.face.startCamera(cb);
  }
  //////////////////////////////////////////////////////////
  loadAsync(cb){
    this.loadNeck(()=>{
      this.world.loadModels(cb);
    });
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
    this.world.setTeamPos(null, null);
    this.world._camera.rotation.set(0,0,0);
    if(this.controls){
      this.controls.lookAt(this.world.redGate.position);
    }
    this.mngrState.startTs = 0;
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
    // stop broadcast interval
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
    // cant start while exploding
    if(!this.moving && this.exploding){
      this.playAudio('wrong');
      console.log('cant start while exploding');
      return;
    }
    this.stopWarning();
    this.moving = !this.moving;
    this.controls.autoForward = !this.disableConstantSpeed &&  this.moving;
    this.controls.enabled = this.moving;
    //this.controls
    // const pos = this.world.camera.position.clone();
    // deepStream.sendEvent('player',{
    //   type:"start",
    //   moving:this.moving,
    //   pos:pos,
    //   nick:this.localState.nick
    // });
    // start
    if(this.moving){
      if(this.useNeck){
        this.controls.face.captureCenterXY();
      }

      if(this.first){
        this.first = false;

        if (!this.disableSound) {
          this.world.sound.play();
        }
        //this.world.onFirst();
      }
    }
    // stop
    else{
      //this.world.sound.pause();
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
      if(this.useNeck){
        // face should be loaded during loadAsync()
        this.controls = new THREE.NeckPersonControls(this.world.camera, this.world.renderer.domElement, this.face);
        console.log('USING NECK CONTROLS!');
      }else{
        this.controls = new THREE.FirstPersonControls(this.world.camera, this.world.renderer.domElement);
      }
      this.controls.activeLook = true;
      this.controls.movementSpeed = config.distancePerMS;
      this.controls.constrainVertical = true;
      this.controls.verticalMax  = 1.6 + config.vertLimit;
      this.controls.verticalMin  = 1.6 - config.vertLimit;
      this.controls.lookSpeed = config.lookSpeed;
    }
    this.controls.enabled = init;
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
    document.getElementById('game-display').style.display = html? "block":"none";
    document.getElementById('msg').innerHTML = html;
  }
  //////////////////////////////////////////////////////////
  show321(){
    this.tid321 = setInterval(() =>{
      const diff = this.mngrState.startTs - Date.now();
      if(diff > 0){
        var seconds = Math.floor(diff / 1000);
        var tenth  = parseInt((new Date(diff)).getMilliseconds() / 100);
        this.setGameMsg(`GAME BEGINS IN ${seconds}:${tenth}`);
        // ping only on last 3 sec - locked when ready
        if(tenth === 0 && seconds <= 3){
          this.playAudio((seconds > 0 )? 'ping':'locked');
        }
      }
      // end
      else{
        if(this.tid321){
          clearInterval(this.tid321);
          this.tid321 = null;
        }
        // resume
        this.onGameStarted();
      }
    },50);
  }
  //////////////////////////////////////////////////////////
  onGameStarted(){
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('game-display').style.display = 'block';

    // either way update whos on ehich team
    this.world.setPlayerTeams(this.mngrState.red, this.mngrState.blue);
    this.world.players.started = true;

    // 3 2 1
    if(Date.now() < this.mngrState.startTs){
      // show countdown
      this.show321();
      //this.setGameMsg('game begins in:');
      return;
    }else{ // happens after Reload
      // update world
      this.world.setNick(this.localState.nick);
      this.world.setTeamPos(this.localState.isRed);

      this.world.resetGateRotation();

      // handle Flags
      this.holdingFlag = (this.localState.nick === this.mngrState.redHolder || this.localState.nick === this.mngrState.blueHolder);
      this.world.setFlagHolders(this.holdingFlag, this.localState, this.mngrState);

      // drop flag if has it after reloading
      if(this.holdingFlag){
        this.tellDropFlag(this.holdingFlag);
        this.setGameMsg('Flag was dropped during game page reload');
      }

      // start broadcast interval
      this.startUpdateLoop(true);
      this.startBorderLoop(true);

      // to enable start stop
      this.setGameMsg('press any key to start');

      // start FPS loop
      const fps = document.getElementById('fps');
      this.frames = 0;
      setInterval(()=>{
        fps.innerHTML = 'FPS: ' + this.frames;
        this.frames = 0;
      },1000);
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
    this.startBorderLoop(false);
    this.stopWarning();

    this.resetAll();
    //this.world.setTeamPos(null); // also sets players joined to null
  }
  //////////////////////////////////////////////////////////
  onMngrState(state){
    this.tellingGatePass = false; //- must have been finished

    // store
    this.mngrState = state;
    // to add dummies during game
    this.world.setPlayerTeams(state.red, state.blue);

    // reset from mngr
    if(state.needReset){
      this.resetAll();
      document.getElementById('game-display').style.display = 'none';
      document.getElementById('req-start').style.display = 'none';
      document.getElementById('welcome').style.display = 'block';
    }

    const joined = this.isJoined();
    // update players module - to avoid events
    this.world.players.gameJoined = joined;


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
      // first means hasnt moved, after reload
      if(joined){
        if(this.first){
          // return/start game
          this.onGameStarted();
        }else{
          // Ongoing game update (not first since reload)

          // Handle Flags
          const holdingFlag = (this.localState.nick === this.mngrState.redHolder || this.localState.nick === this.mngrState.blueHolder);

          this.world.setFlagHolders(holdingFlag, this.localState, this.mngrState);

          // play success if it was flag got captured
          if(holdingFlag && !this.holdingFlag){
            // SUCCESS - you are the holder of the flag
            this.setGameMsg('return the flag to you home gate');
            this.playAudio('success');
          }
          this.holdingFlag = holdingFlag;

          // drop flag if exploding during this update from nanager
          if(this.exploding){
            this.setGameMsg('flag was dropped during explosion');
            this.tellDropFlag();
          }
        }
      }
      // game started but not joined
      else {
        document.getElementById('welcome').style.display = "block";
        document.getElementById('inputs').style.display = "none";
        document.getElementById('teams').style.display = "none";
        document.getElementById('started').innerText = "game has started - please wait for next game to start";
      }
      return;
    }
    // show welcome as game isnt over and hasnt started yet
    document.getElementById('welcome').style.display = "block";

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
    document.getElementById('start').style.display = (state.ready && joined)? '':'none';

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
    });
  }
  //////////////////////////////////////////////////////////
  createWorld(){
    this.world = new World();
  }
  //////////////////////////////////////////////////////////
  stopAudio(id){
    let sound = !this.disableSound && document.getElementById(id);
    if(sound){
      if( !sound.paused && !sound.ended && 0 < sound.currentTime){
        sound.pause();
        sound.currentTime = 0;
      }
    }
  }
  //////////////////////////////////////////////////////////
  playAudio(id, cb){
    let sound =  !this.disableSound && document.getElementById(id);
    if(sound){

      // stop first
      this.stopAudio(id);
      const begin = sound.getAttribute('begin');
      sound.currentTime = begin? parseFloat(begin) : 0;

      let prms = sound.play();
      if(cb){
        prms.then(cb);
      }
    }
    else{
      console.error(`${id} is missing in audio`);
    }
  }
  //////////////////////////////////////////////////////////
  tellGatePass(winGate){
    this.tellingGatePass = true; // to avoid exploding - reset on mngr state
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
      }/*else{ - Receive it onMngrState
        this.holdingFlag = true;
        // SUCCESS - you are the holder of the flag
        this.playAudio('success');
      }*/
    });
  }
  //////////////////////////////////////////////////////////
  passInGate(gate){
    // correct far gate
    if(this.localState.isRed == (gate.name == "redGate")){
      console.log('collect gatePass!', gate.name);
      // tell mngr
      this.tellGatePass(false);
    }else{
      const team = this.localState.isRed?'red':'blue';
      // return to home gate - Game Won?
      if(this.holdingFlag){
        this.setGameMsg(`<span class="${team}">${team} TEAM</span> WINS thanks to you!`);
        this.playAudio('success');
        this.tellGatePass(true);
      }
      else{
        // home gate - before captured (holdingFlag = False)
        console.log('wrong gatePass!', gate.name);
        this.setGameMsg(`capture the <span class="${this.localState.isRed?'red':'blue'}">flag</span> before passing in <span class="${this.localState.isRed?'red':'blue'}> this gate</span> `);
        this.playAudio('wrong');
      }
    }
  }
  //////////////////////////////////////////////////////////
  tellDropFlag(){
    // if(!this.holdingFlag){
    //   return;
    // }
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
        console.log('flagDrop: '+result);
      }
    });
  }
  //////////////////////////////////////////////////////////
  startBorderLoop(start){
    // ignore when game is over.
    if(!start){
      clearInterval(this.borderLoopTID);
      this.borderLoopTID = 0;
      return;
    }

    let outside = 0;
    this.borderLoopTID = setInterval(()=>{
      if(!this.moving || this.exploding || this.gameOver) {
        outside = 0; // fix exlode on start bug
        return;
      }

      if(outside > config.secCrossBorder * 10){
        outside = 0;
        this.doExplode();
        return;
      }
      if(!this.world.checkCrossBorders()){
        if(outside) this.stopWarning();
        outside = 0;
      }
      else{
        // MANUAL STOP - this is not the bug!
        if(!outside) this.startWarning('dont fly outside the game boundaries', true);
        outside++;

      }
    }, 100);


  }
  //////////////////////////////////////////////////////////
  startUpdateLoop(start){
    // stop - always tell your position
    if(!start){
      if(this.updateLoopTID){
        clearInterval(this.updateLoopTID);
        this.updateLoopTID = 0;
      }
      return;
    }
    // start
    let cam = this.world.camera;

    this.updateLoopTID = setInterval(()=>{
      // conditions
      if(this.exploding){
        return;
      }
      if(this.gameOver){
        return;
      }
      if(document.hidden){
        return;
      }
      // if(!this.moving){
      //   return;
      // }
      cam.updateMatrixWorld();

      // broadcast position
      cam.getWorldDirection(this.direction);
      const pos = cam.position.clone();
      deepStream.sendEvent('player',{
        type:"pos",
        nick: this.localState.nick,
        moving: this.moving,
        // new
        pos: {
          x:pos.x,
          y:pos.y,
          z:pos.z
        },
        // new
        dir: {
          x:this.direction.x,
          y:this.direction.y,
          z:this.direction.z
        },
      });
    }, config.updateInterval);
  }
  //////////////////////////////////////////////////////////
  // obj - your object (THREE.Object3D or derived)
  // point - the point of rotation (THREE.Vector3)
  // axis - the axis of rotation (normalized THREE.Vector3)
  // theta - radian value of rotation
  //////////////////////////////////////////////////////////
  // calcTargetPos(cam, worldDir){
  //   this.targetPos = cam.position.clone();
  //   //return this.targetPos;
  //   const turnFactor = 0.8;
  //   const distance = config.distancePerMS * config.updateInterval * turnFactor;
  //   // move forward
  //   const direction = worldDir.multiplyScalar(distance);
  //   this.targetPos.add(direction);
  //   return this.targetPos;
  // }
  //////////////////////////////////////////////////////////
  checkGatePass(){
    // always check (even when passing to know if exited)
    const gate = this.world.checkGatePass();
    // enter gate pass
    if(!this.passingGate && gate){
      console.log(`enter ${gate.name}`);
      this.passingGate = gate; // reset this flag during explosion
      return true; // avoid collision check
    }
    // exit of gate pass
    if(this.passingGate && !gate){
      console.log(`exit ${this.passingGate.name}`);
      // pass confirmed- logic in this func call
      this.passInGate(this.passingGate);
      this.passingGate = null;
      return true; // avoid collision check
    }
    return false;
  }
  //////////////////////////////////////////////////////////
  startWarning(msg, manualStop){
    if(msg) this.setGameMsg(msg);
    this.playAudio('alarm');
    this.world.turnWarningEffect(true);
    if(!manualStop){
      this.tidWarning = setTimeout(() => this.stopWarning(),config.targetLockMs);
    }
  }
  //////////////////////////////////////////////////////////
  stopWarning(){
    // dont turn effect off
    // and dont change message
    // when exploding
    if(!this.exploding){
       this.world.turnWarningEffect(false);
       this.setGameMsg('');
    }
    this.stopAudio('alarm');
    if(this.tidWarning){
      clearTimeout(this.tidWarning);
      this.tidWarning = 0;
    }
  }
  //////////////////////////////////////////////////////////
  doExplode(msg){
    this.exploding = true;
    this.passingGate = null;

    this.stopWarning();
    this.setGameMsg(msg || 'BOOM!!!');

    // return flag if holders
    this.tellDropFlag();

    // STOP FLYING!
    if(this.moving){
      this.startStop();
    }
    // local var for back to start
    let cam = this.world.camera;
    let direction = new THREE.Vector3();
    // visual
    this.world.turnWarningEffect(true);
    this.world.doExplode();
    this.playAudio('explode');
    // look at oposite gate
    const gate = this.localState.isRed? this.world.redGate : this.world.blueGate;
    //this.controls.lookAt(gate.position);
    // event explosion
    deepStream.sendEvent('player',{
      type:"explode",
      flag:true,
      pos:cam.position.clone(),
      dir:direction,
      nick: this.localState.nick
    });

    // return to start
    this.world.return2Start(()=>{
      console.log("FINISH RETURN TO START");
      this.setGameMsg('Let us start again');
      this.playAudio('locked');
      this.world.turnWarningEffect(false);
      this.controls.lookAt(gate.position);
      this.exploding = false;
      // broadcast final pos
      let cam = this.world.camera;
      cam.getWorldDirection(direction);
      deepStream.sendEvent('player',{
        type:"explode",
        flag:false,
        pos:cam.position.clone(),
        dir:direction,
        nick: this.localState.nick
      });
    }, this.controls, gate);
  }
  //////////////////////////////////////////////////////////
  checkFireTarget(data) {
    if(data.targetNick == this.localState.nick){
      this.doExplode();
    }
  }
  checkLockOnTarget(data){
    if(data.targetNick == this.localState.nick){
      if(data.on){
        this.startWarning(`WARNING! ${data.nick} is locking on you!`);
      }else{
        this.stopWarning();
        //this.setGameMsg(`${data.nick} lost aim on you`);
      }
    }
  }
  //////////////////////////////////////////////////////////
  doPassFlag(target){
    deepStream.client.rpc.make('client',{
      type:"passFlag",
      isRed: this.localState.isRed,
      nick: this.localState.nick,
      targetNick: target.nick
    },(error,result) => {
      if(error){
        this.onError(error);
        return;
      }
      if(result!='ok'){
        this.setGameMsg('passFlag: '+result);
      }
    });
  }
  //////////////////////////////////////////////////////////
  doFire(){
    if(!this.moving) return;
    if(!this.world.shooting) return;
    if(this.firing) return;

    // shooting an enemy
    if(!this.world.shooting.locked){
      this.setGameMsg('lock target before fire');
      this.playAudio('wrong');
      return;
    }

    // firing
    this.firing = true;
    this.playAudio('laser',()=>{
      this.firing = false;
      //this.world.shooting.firing = false;
    });

    // pass the flag to friend
    if(this.world.shooting.friend && this.holdingFlag){
      this.doPassFlag(this.world.shooting.targetPlayer);
      return;
    }

    // fire enemy
    deepStream.sendEvent('player',{
      type:"fire",
      nick: this.localState.nick,
      targetNick: this.world.shooting.targetPlayer.nick
    });

    // hide player TODO: ???

    // reset shooting
    //this.world.shooting.onFire();
  }
  //////////////////////////////////////////////////////////
  keydown(e){
    //console.log('keydown code=', e.code);
    // not started
    if(!this.mngrState || !this.mngrState.started || !this.world.players.gameJoined){
      console.log("cant fly before game started and joined");
      return;
    }

    //e.preventDefault = true;
    switch(e.code){
      case "Space":
        this.startStop();
        break;
      case "Enter":
      case "NumpadEnter": // ori easy fire
      case "KeyF":
        this.doFire();
        break;


    }
    //return false;
  }
  //////////////////////////////////////////////////////////
  render(){
    // FPS measure
    this.frames++;

    const now = Date.now();
    const delta = (now - this.tsRender);
    this.tsRender = now;

    // fly controls
    if(this.controls){
      this.controls.update(delta);
    }

    const collision = this.world.render(delta);
    if(collision){
      this.doExplode();
    }

    // conditions
    if(this.exploding){
      return;
    }

    if(!this.moving){
      return;
    }

    // gate pass
    if(this.checkGatePass()){
      return;
    };
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
    // init controls

    game.world.createScene();
    game.initControls(false);
    game.world.setTeamPos(null);
    game.connect();

    function animate() {
      // request another frame
      requestAnimationFrame(animate);

      // Put your drawing code here
      game.render();
    }

    // start animating
    animate();
  });
}
window.onresize = game.onresize.bind(game);
//window.onfocus = game.onfocus.bind(game);
window.onblur = game.onblur.bind(game);
