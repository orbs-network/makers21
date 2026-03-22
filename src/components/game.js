class Game /*extends THREE.EventDispatcher*/ {
    //////////////////////////////////////////////////////////
    constructor() {
        // Use centralized state manager
        this.state = window.gameState;

        // Use extracted services
        this.network = window.networkService;
        this.ui = window.uiService;

        this.resetMembers();

        // Settings from gameState
        this.useNeck = this.state.settings.useNeck;
        this.stillTargetEnabled = this.state.settings.stillTargetEnabled;
        this.disableConstantSpeed = this.state.settings.disableConstantSpeed;
        this.disableSound = this.state.settings.disableSound;
    }

    //////////////////////////////////////////////////////////
    // Getters/setters that proxy to gameState for backward compatibility
    get moving() { return this.state.game.moving; }
    set moving(v) { this.state.update('game.moving', v); }

    get exploding() { return this.state.game.exploding; }
    set exploding(v) { this.state.update('game.exploding', v); }

    get holdingFlag() { return this.state.game.holdingFlag; }
    set holdingFlag(v) { this.state.update('game.holdingFlag', v); }

    get passingGate() { return this.state.game.passingGate; }
    set passingGate(v) { this.state.update('game.passingGate', v); }

    get gameOver() { return this.state.game.gameOver; }
    set gameOver(v) { this.state.update('game.gameOver', v); }

    get first() { return this.state.game.first; }
    set first(v) { this.state.update('game.first', v); }

    get tellingGatePass() { return this.state.game.tellingGatePass; }
    set tellingGatePass(v) { this.state.update('game.tellingGatePass', v); }

    get localState() { return this.state.local; }
    set localState(v) {
        if (v.nick !== undefined) this.state.update('local.nick', v.nick);
        if (v.isRed !== undefined) this.state.update('local.isRed', v.isRed);
    }

    get mngrState() { return this.state.manager; }
    set mngrState(v) { this.state.updateManagerState(v); }

    //////////////////////////////////////////////////////////
    resetMembers() {
        if (this.state) {
            this.state.resetGame();
        }
        this._persistentMsg = '';
        this.targetPos = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.tsRender = Date.now();
    }

    //////////////////////////////////////////////////////////
    loadLocalState() {
        // State is loaded by GameState constructor
        this.state.loadLocal();
    }

    //////////////////////////////////////////////////////////
    saveLocalState() {
        // update localState from UI
        this.state.update('local.isRed', this.ui.isRedSelected());
        // Save to localStorage
        this.state.saveLocal();
    }

    //////////////////////////////////////////////////////////
    // Async method to load face tracking (neck controls)
    async loadNeck() {
        if (!this.useNeck) {
            return;
        }
        this.face = new Face();
        await this.face.startCamera();
    }

    //////////////////////////////////////////////////////////
    // Async method to load all game assets
    async loadAsync(cb) {
        await this.loadNeck();
        await this.world.loadModels();
        if (cb) cb(); // Support legacy callback pattern
    }

    //////////////////////////////////////////////////////////
    isJoined() {
        return this.state.isJoined();
    }

    //////////////////////////////////////////////////////////
    onError(error) {
        console.error(error);
        this.setGameMsg(`Error: ${error}`);
    }

    //////////////////////////////////////////////////////////
    // oposite to on game start
    resetAll() {
        console.log('reset ALL');
        this.resetMembers();

        // update world
        this.world.setNick(this.localState.nick);
        this.world.setTeamPos(null, null);
        this.world._camera.rotation.set(0, 0, 0);
        if (this.controls) {
            this.controls.lookAt(this.world.redGate.position);
        }
        this.mngrState.startTs = 0;
        this.world.resetGateRotation();

        // 321 stop if in middle
        if (this.tid321) {
            clearInterval(this.tid321);
            this.tid321 = null;
        }

        // reset flags to gates (don't try to attach to holders during reset)
        this.world.resetFlags();
        this.world.reset();

        // init controls
        this.initControls(false);
        // stop broadcast interval
        this.startUpdateLoop(false);
        // to enable start stop
        this.setGameMsg('game has been reset!');
    }

    //////////////////////////////////////////////////////////
    async onJoin() {
        // save current local state
        this.saveLocalState();
        try {
            const result = await this.network.join(this.localState.nick, this.localState.isRed);
            if (result !== 'ok') {
                this.setGameMsg('join: ' + result);
            }
        } catch (error) {
            this.onError(error);
        }
        // update world
        this.world.setNick(this.localState.nick);
        this.world.setTeamPos(this.localState.isRed);
    }

    //////////////////////////////////////////////////////////
    async onLeave() {
        // save current local state
        this.saveLocalState();
        try {
            const result = await this.network.leave(this.localState.nick, this.localState.isRed);
            if (result !== 'ok') {
                this.setGameMsg('leave: ' + result);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    //////////////////////////////////////////////////////////
    async onStart() {
        this.ui.showRequestStart();
        try {
            await this.network.start(this.localState.nick);
        } catch (error) {
            console.error(error);
        }
    }

    //////////////////////////////////////////////////////////
    async onReset() {
        try {
            await this.network.reset(this.localState.nick);
        } catch (error) {
            console.error('reset', error);
        }
    }

    //////////////////////////////////////////////////////////
    uxInit() {
        // Initialize UI with event handlers
        this.ui.init({
            onJoin: this.onJoin.bind(this),
            onLeave: this.onLeave.bind(this),
            onStart: this.onStart.bind(this),
            onReset: this.onReset.bind(this),
            onKeydown: this.keydown.bind(this),
            onNickChange: (value) => {
                if (value.length > 2) {
                    this.localState.nick = value;
                    this.saveLocalState();
                }
            },
        });
        // Set initial input values
        this.setInputs();
    }

    //////////////////////////////////////////////////////////
    startStop() {
        // cant start while exploding
        if (!this.moving && this.exploding) {
            this.playAudio('wrong');
            console.log('cant start while exploding');
            return;
        }
        this.stopWarning();
        this.moving = !this.moving;
        this.controls.autoForward = !this.disableConstantSpeed && this.moving;
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
        if (this.moving) {
            if (this.useNeck) {
                this.controls.face.captureCenterXY();
            }

            if (this.first) {
                this.first = false;

                if (!this.disableSound) {
                    this.world.sound.play();
                }
                //this.world.onFirst();
            }
        }
        // stop
        else {
            //this.world.sound.pause();
        }
    }

    //////////////////////////////////////////////////////////
    onblur() {
        if (this.moving && localStorage.getItem('debug') !== "true") {
            this.startStop();
        }
    }

    //////////////////////////////////////////////////////////
    initControls(init) {
        if (!this.controls) {
            if (this.useNeck) {
                // face should be loaded during loadAsync()
                this.controls = new THREE.NeckPersonControls(this.world.camera, this.world.renderer.domElement, this.face);
                console.log('USING NECK CONTROLS!');
            } else {
                this.controls = new THREE.FirstPersonControls(this.world.camera, this.world.renderer.domElement);
            }
            this.controls.activeLook = true;
            this.controls.movementSpeed = config.distancePerMS;
            this.controls.constrainVertical = true;
            // this.controls.verticalMax  = 1.6 + config.vertLimit;
            // this.controls.verticalMin  = 1.6 - config.vertLimit;
            this.controls.lookSpeed = config.lookSpeed;
        }
        this.controls.enabled = init;
    }

    //////////////////////////////////////////////////////////
    setInputs() {
        this.ui.setInputs(this.localState.nick, this.localState.isRed);
    }

    //////////////////////////////////////////////////////////
    setGameMsg(html) {
        this.ui.setGameMsg(html);
    }

    setPersistentMsg(html) {
        this._persistentMsg = html || '';
        this.ui.setGameMsg(html);
    }

    clearPersistentMsg() {
        this._persistentMsg = '';
    }

    //////////////////////////////////////////////////////////
    show321() {
        this.tid321 = setInterval(() => {
            const diff = this.mngrState.startTs - Date.now();
            if (diff > 0) {
                const seconds = Math.floor(diff / 1000);
                const tenth = parseInt((new Date(diff)).getMilliseconds() / 100);
                this.setGameMsg(`GAME BEGINS IN ${seconds}:${tenth}`);
                // ping only on last 3 sec - locked when ready
                if (tenth === 0 && seconds <= 3) {
                    this.playAudio((seconds > 0) ? 'ping' : 'locked');
                }
            }
            // end
            else {
                if (this.tid321) {
                    clearInterval(this.tid321);
                    this.tid321 = null;
                }
                // resume
                this.onGameStarted();
            }
        }, 50);
    }

    //////////////////////////////////////////////////////////
    onGameStarted() {
        this.ui.showGameDisplay();
        if (this.world.shooting) {
            this.world.shooting.hud.visible = true;
            this.world.shooting.hudLabelObj.visible = true;
        }

        // either way update whos on ehich team
        this.world.setPlayerTeams(this.mngrState.red, this.mngrState.blue);
        this.world.players.started = true;

        // 3 2 1
        if (Date.now() < this.mngrState.startTs) {
            // show countdown
            this.show321();
            return;
        } else { // happens after Reload
            // update world
            this.world.setNick(this.localState.nick);
            this.world.setTeamPos(this.localState.isRed);

            this.world.resetGateRotation();

            // handle Flags
            this.holdingFlag = (this.localState.nick === this.mngrState.redHolder || this.localState.nick === this.mngrState.blueHolder);
            this.world.setFlagHolders(this.holdingFlag, this.localState, this.mngrState);

            // drop flag if has it after reloading
            if (this.holdingFlag) {
                this.tellDropFlag(this.holdingFlag);
                this.setGameMsg('Flag was dropped during game page reload');
            }

            // start broadcast interval
            this.startUpdateLoop(true);
            this.startBorderLoop(true);

            // to enable start stop
            this.setGameMsg('Press Space to start!');

            // start FPS loop
            this.ui.startFPSCounter();
        }
    }

    //////////////////////////////////////////////////////////
    onGameOver() {
        this.ui.showGameOver(this.mngrState.winnerNick, this.mngrState.winnerIsRed);
        if (this.world.shooting) {
            this.world.shooting.hud.visible = false;
            this.world.shooting.hudLabelObj.visible = false;
        }
        this.moving = false;
        this.startUpdateLoop(false);
        this.startBorderLoop(false);
        this.stopWarning();
    }

    //////////////////////////////////////////////////////////
    onMngrState(state) {
        this.tellingGatePass = false; //- must have been finished

        // store
        this.mngrState = state;
        // to add dummies during game
        this.world.setPlayerTeams(state.red, state.blue);

        // reset from mngr
        if (state.needReset) {
            this.resetAll();
            this.ui.showWelcome();
        }

        const joined = this.isJoined();
        // update players module - to avoid events
        this.world.players.gameJoined = joined;


        // online status
        this.ui.setOnlineStatus("connected!");

        //////////////////////////////////////////////////////////
        // game you have joined - is WON
        if (joined && state.winnerNick) {
            this.onGameOver();
            return;
        }
        this.ui.hideGameOver();

        //////////////////////////////////////////////////////////
        // game already started
        if (state.started) {
            // first means hasnt moved, after reload
            if (joined) {
                if (this.first) {
                    // return/start game
                    this.onGameStarted();
                } else {
                    // Ongoing game update (not first since reload)

                    // Handle Flags
                    const holdingFlag = (this.localState.nick === this.mngrState.redHolder || this.localState.nick === this.mngrState.blueHolder);

                    this.world.setFlagHolders(holdingFlag, this.localState, this.mngrState);

                    // play success if it was flag got captured
                    if (holdingFlag && !this.holdingFlag) {
                        // SUCCESS - you are the holder of the flag
                        this.setPersistentMsg('Return the flag to your home gate');
                        this.playAudio('success');
                    } else if (!holdingFlag && this.holdingFlag) {
                        this.clearPersistentMsg();
                    }
                    this.holdingFlag = holdingFlag;

                    // drop flag if exploding during this update from nanager
                    if (this.exploding) {
                        this.setGameMsg('Flag was dropped during explosion');
                        this.tellDropFlag();
                    }
                }
            }
            // game started but not joined
            else {
                this.ui.showWaitingForNextGame();
            }
            return;
        }

        // Show lobby state
        this.ui.showLobby({
            ready: state.ready,
            red: state.red,
            blue: state.blue,
            joined: joined,
            localNick: this.localState.nick,
            localIsRed: this.localState.isRed,
        });

        if (!joined) {
            // neutral position
            this.world.setTeamPos(null);
            return;
        }
        // world team (on load after joined)
        this.world.setTeamPos(this.localState.isRed);
    }

    //////////////////////////////////////////////////////////
    onEvent(data) {
        switch (data.type) {
            case "state":
                this.onMngrState(data.state);
                break;
        }
    }

    //////////////////////////////////////////////////////////
    onOffline() {
        this.ui.setOnlineStatus("Could not connect, please reload to retry");
        console.log('offline!!!');
    }

    //////////////////////////////////////////////////////////
    async connect() {
        this.ui.setOnlineStatus("connecting...");
        // send join - receive state
        this.network.subscribe('mngr', this.onEvent.bind(this));

        try {
            const result = await this.network.checkOnline();
            this.onMngrState(result.state);
        } catch (error) {
            console.error(error);
            this.onOffline();
        }
    }

    //////////////////////////////////////////////////////////
    createWorld() {
        this.world = new World();
    }

    //////////////////////////////////////////////////////////
    stopAudio(id) {
        let sound = !this.disableSound && document.getElementById(id);
        if (sound) {
            if (!sound.paused && !sound.ended && 0 < sound.currentTime) {
                sound.pause();
                sound.currentTime = 0;
            }
        }
    }

    //////////////////////////////////////////////////////////
    playAudio(id, cb) {
        let sound = !this.disableSound && document.getElementById(id);
        if (sound) {

            // stop first
            this.stopAudio(id);
            const begin = sound.getAttribute('begin');
            sound.currentTime = begin ? parseFloat(begin) : 0;

            let prms = sound.play();
            if (cb) {
                prms.then(cb);
            }
        } else {
            console.error(`${id} is missing in audio`);
        }
    }

    //////////////////////////////////////////////////////////
    async tellGatePass(winGate) {
        this.tellingGatePass = true; // to avoid exploding - reset on mngr state
        try {
            const result = await this.network.gatePass(this.localState.nick, this.localState.isRed, winGate);
            if (result !== 'ok') {
                this.setGameMsg('gatePass: ' + result);
                this.playAudio('wrong');
            }
            // Success is received via onMngrState
        } catch (error) {
            this.onError(error);
        }
    }

    //////////////////////////////////////////////////////////
    passInGate(gate) {
        // correct far gate
        if (this.localState.isRed === (gate.name === "redGate")) {
            console.log('collect gatePass!', gate.name);
            // tell mngr
            this.tellGatePass(false);
        } else {
            const team = this.localState.isRed ? 'red' : 'blue';
            // return to home gate - Game Won?
            if (this.holdingFlag) {
                this.setGameMsg(`<span class="${team}">${team} TEAM</span> WINS thanks to you!`);
                this.playAudio('success');
                this.tellGatePass(true);
            } else {
                // home gate - before captured (holdingFlag = False)
                console.log('wrong gatePass!', gate.name);
                this.setGameMsg(`capture the <span class="${this.localState.isRed ? 'red' : 'blue'}">flag</span> before passing in <span class="${this.localState.isRed ? 'red' : 'blue'}> this gate</span> `);
                this.playAudio('wrong');
            }
        }
    }

    //////////////////////////////////////////////////////////
    async tellDropFlag() {
        try {
            const result = await this.network.flagDrop(this.localState.nick, this.localState.isRed);
            if (result !== 'ok') {
                console.log('flagDrop: ' + result);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    //////////////////////////////////////////////////////////
    startBorderLoop(start) {
        // ignore when game is over.
        if (!start) {
            clearInterval(this.borderLoopTID);
            this.borderLoopTID = 0;
            return;
        }

        let outside = 0;
        this.borderLoopTID = setInterval(() => {
            if (!this.moving || this.exploding || this.gameOver) {
                outside = 0; // fix exlode on start bug
                return;
            }

            if (outside > config.secCrossBorder * 10) {
                outside = 0;
                this.doExplode();
                return;
            }
            if (!this.world.checkCrossBorders()) {
                if (outside) this.stopWarning();
                outside = 0;
            } else {
                // MANUAL STOP - this is not the bug!
                if (!outside) this.startWarning('dont fly outside the game boundaries', true);
                outside++;

            }
        }, 100);


    }

    //////////////////////////////////////////////////////////
    startUpdateLoop(start) {
        // stop - always tell your position
        if (!start) {
            if (this.updateLoopTID) {
                clearInterval(this.updateLoopTID);
                this.updateLoopTID = 0;
            }
            return;
        }
        // start
        let cam = this.world.camera;

        this.updateLoopTID = setInterval(() => {
            // conditions
            if (this.exploding) {
                return;
            }
            if (this.gameOver) {
                return;
            }
            if (document.hidden) {
                return;
            }
            // if(!this.moving){
            //   return;
            // }
            cam.updateMatrixWorld();

            // broadcast position
            cam.getWorldDirection(this.direction);
            const pos = cam.position.clone();
            this.network.broadcastPosition({
                type: "pos",
                nick: this.localState.nick,
                moving: this.moving,
                pos: {
                    x: pos.x,
                    y: pos.y,
                    z: pos.z
                },
                dir: {
                    x: this.direction.x,
                    y: this.direction.y,
                    z: this.direction.z
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
    checkGatePass() {
        // always check (even when passing to know if exited)
        const gate = this.world.checkGatePass();
        // enter gate pass
        if (!this.passingGate && gate) {
            console.log(`enter ${gate.name}`);
            this.passingGate = gate; // reset this flag during explosion
            return true; // avoid collision check
        }
        // exit of gate pass
        if (this.passingGate && !gate) {
            console.log(`exit ${this.passingGate.name}`);
            // pass confirmed- logic in this func call
            this.passInGate(this.passingGate);
            this.passingGate = null;
            return true; // avoid collision check
        }
        return false;
    }

    //////////////////////////////////////////////////////////
    startWarning(msg, manualStop) {
        if (msg) this.setGameMsg(msg);
        this.playAudio('alarm');
        this.world.turnWarningEffect(true);
        if (!manualStop) {
            this.tidWarning = setTimeout(() => this.stopWarning(), config.targetLockMs);
        }
    }

    //////////////////////////////////////////////////////////
    stopWarning() {
        // dont turn effect off
        // and dont change message
        // when exploding
        if (!this.exploding) {
            this.world.turnWarningEffect(false);
            this.setGameMsg(this._persistentMsg || '');
        }
        this.stopAudio('alarm');
        if (this.tidWarning) {
            clearTimeout(this.tidWarning);
            this.tidWarning = 0;
        }
    }

    //////////////////////////////////////////////////////////
    doExplode(msg) {
        this.exploding = true;
        this.passingGate = null;

        this.stopWarning();
        this.setGameMsg(msg || 'BOOM!!!');

        // return flag if holders
        this.tellDropFlag();

        // STOP FLYING!
        if (this.moving) {
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
        const gate = this.localState.isRed ? this.world.redGate : this.world.blueGate;
        //this.controls.lookAt(gate.position);
        // event explosion
        this.network.sendEvent('player', {
            type: "explode",
            flag: true,
            pos: cam.position.clone(),
            dir: direction,
            nick: this.localState.nick
        });

        // return to start
        this.world.return2Start(() => {
            console.log("FINISH RETURN TO START");
            this.setGameMsg('Lets start again...');
            this.playAudio('locked');
            this.world.turnWarningEffect(false);
            this.controls.lookAt(gate.position);
            this.exploding = false;
            // broadcast final pos
            let cam = this.world.camera;
            cam.getWorldDirection(direction);
            this.network.sendEvent('player', {
                type: "explode",
                flag: false,
                pos: cam.position.clone(),
                dir: direction,
                nick: this.localState.nick
            });
        }, this.controls, gate);
    }

    //////////////////////////////////////////////////////////
    checkFireTarget(data) {
        if (data.targetNick == this.localState.nick) {
            this.doExplode();
        }
    }

    checkLockOnTarget(data) {
        if (data.targetNick == this.localState.nick) {
            if (data.on) {
                this.startWarning(`WARNING! ${data.nick} is locking on you!`);
            } else {
                this.stopWarning();
                //this.setGameMsg(`${data.nick} lost aim on you`);
            }
        }
    }

    //////////////////////////////////////////////////////////
    async doPassFlag(target) {
        try {
            const result = await this.network.passFlag(this.localState.nick, this.localState.isRed, target.nick);
            if (result !== 'ok') {
                this.setGameMsg('passFlag: ' + result);
            }
        } catch (error) {
            this.onError(error);
        }
    }

    //////////////////////////////////////////////////////////
    doFire() {
        if (!this.moving) return;
        if (!this.world.shooting) return;
        if (this.firing) return;

        // shooting an enemy
        if (!this.world.shooting.locked) {
            this.setGameMsg('lock target before fire');
            this.playAudio('wrong');
            return;
        }

        // firing
        this.firing = true;
        this.playAudio('laser', () => {
            this.firing = false;
            //this.world.shooting.firing = false;
        });

        // pass the flag to friend
        if (this.world.shooting.friend && this.holdingFlag) {
            this.doPassFlag(this.world.shooting.targetPlayer);
            return;
        }

        // fire enemy
        this.network.sendEvent('player', {
            type: "fire",
            nick: this.localState.nick,
            targetNick: this.world.shooting.targetPlayer.nick
        });

        // hide player TODO: ???

        // reset shooting
        //this.world.shooting.onFire();
    }

    //////////////////////////////////////////////////////////
    keydown(e) {
        //console.log('keydown code=', e.code);
        // not started
        if (!this.mngrState || !this.mngrState.started || !this.world.players.gameJoined) {
            console.log("cant fly before game started and joined");
            return;
        }

        //e.preventDefault = true;
        switch (e.code) {
            case "KeyR":
                if (e.ctrlKey) {
                    this.onReset()
                }
                break
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
    render() {
        // FPS measure
        this.ui.incrementFrame();

        const now = Date.now();
        const delta = (now - this.tsRender);
        this.tsRender = now;

        // fly controls
        if (this.controls) {
            this.controls.update(delta);
        }

        const collision = this.world.render(delta);
        if (collision) {
            this.doExplode();
        }

        // conditions
        if (this.exploding) {
            return;
        }

        if (!this.moving) {
            return;
        }

        // gate pass
        if (this.checkGatePass()) {
            return;
        }
        ;
    }

    //////////////////////////////////////////////////////////
    onresize(e) {
        this.world.onresize(e);

        // for mouse
        // this.v2.x = ( e.clientX / window.innerWidth ) * 2 - 1;
        // this.v2.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
        if (this.controls) {
            this.controls.handleResize(e);
        }
    }
}

// Make Game class available globally
window.Game = Game;
