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
        this.gameSetupDone = false;
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
    async onReset() {
        // Play Again: host triggers server reset (which broadcasts to all),
        // anyone else just heads back to the lobby room view.
        try {
            if (this.localState.nick === this.hostNick) {
                await this.network.reset(this.localState.nick);
            }
        } catch (error) {
            console.error('reset', error);
        }
        window.location.href = '/?room=' + (this.roomId || '');
    }

    //////////////////////////////////////////////////////////
    uxInit() {
        // Initialize in-game UI handlers (lobby is in lobby.html — separate page)
        this.ui.init({
            onReset: this.onReset.bind(this),
            onKeydown: this.keydown.bind(this),
        });

        // Show face control panel (toolbar always visible for toggle)
        const facePanel = document.getElementById('face-panel');
        if (facePanel) {
            facePanel.style.display = 'block';
            // Hide face canvas if not using face controls
            const faceDisplay = document.getElementById('face-display');
            if (faceDisplay && !this.useNeck) {
                faceDisplay.style.display = 'none';
            }
        }

        // S key: toggle face view AND control mode together
        // Showing face = face steering, hiding face = mouse steering
        const self = this;
        const toggleFaceAndControls = async () => {
            // Initialize face tracking if not loaded
            if (!self.face) {
                self.face = new Face();
                await self.face.startCamera();
            }
            const faceDisplay = document.getElementById('face-display');
            const wantFace = faceDisplay && faceDisplay.style.display === 'none';
            // Switch control mode to match
            if (wantFace && !self.useNeck) {
                self.toggleControls();
            } else if (!wantFace && self.useNeck) {
                self.toggleControls();
            }
        };
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyS') toggleFaceAndControls();
        });
        const faceToggle = document.getElementById('face-toggle');
        if (faceToggle) {
            faceToggle.addEventListener('click', toggleFaceAndControls);
        }

        // Control toggle button (mouse/face)
        const controlToggle = document.getElementById('control-toggle');
        if (controlToggle) {
            controlToggle.addEventListener('click', this.toggleControls.bind(this));
            controlToggle.innerHTML = this.useNeck ? '🖱 Mouse [M]' : '📷 Face [M]';
            // Gray out if face not available (started with mouse)
            if (!this.face) {
                controlToggle.style.opacity = '0.3';
                controlToggle.style.cursor = 'default';
                controlToggle.innerHTML = '🖱 Mouse';
            }
        }
    }

    //////////////////////////////////////////////////////////
    startStop() {
        // cant start while exploding
        if (!this.moving && this.exploding) {
            this.playAudio('wrong');
            console.log('*** startStop BLOCKED: exploding=true');
            return;
        }
        this.stopWarning();
        this.moving = !this.moving;
        console.log(`*** startStop: moving=${this.moving}`);
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
            // Disable WASD movement — we only use auto-forward and mouse/face look
            this.controls.onKeyDown = () => {};
            this.controls.onKeyUp = () => {};
            this.controls.activeLook = true;
            this.controls.movementSpeed = config.distancePerMS;
            this.controls.constrainVertical = true;
            // this.controls.verticalMax  = 1.6 + config.vertLimit;
            // this.controls.verticalMin  = 1.6 - config.vertLimit;
            this.controls.lookSpeed = config.lookSpeed;
        }
        this.controls.enabled = init;
        console.log(`*** initControls: enabled=${init}`);
    }

    //////////////////////////////////////////////////////////
    toggleControls() {
        // Can only toggle to face if face was initialized at startup
        if (!this.useNeck && !this.face) {
            this.setGameMsg('Face controls not available — restart with camera enabled');
            this.playAudio('wrong');
            return;
        }

        // Stop movement first
        if (this.moving) {
            this.startStop();
        }

        // Toggle mode
        this.useNeck = !this.useNeck;
        this.state.settings.useNeck = this.useNeck;
        localStorage.setItem('disableNeck', this.useNeck ? 'false' : 'true');

        // Destroy old controls
        if (this.controls) {
            this.controls.enabled = false;
            if (this.controls.dispose) this.controls.dispose();
        }
        this.controls = null;

        // Recreate controls
        this.initControls(false);

        // Update UI toggle button
        const toggleBtn = document.getElementById('control-toggle');
        const faceDisplay = document.getElementById('face-display');
        if (this.useNeck) {
            if (toggleBtn) toggleBtn.innerHTML = '🖱 Mouse [M]';
            if (faceDisplay) faceDisplay.style.display = 'block';
            // Start camera if not running
            if (this.face && !this.face.enabled) {
                this.face.startCamera();
            }
            this.setGameMsg('Switched to face controls');
        } else {
            if (toggleBtn) toggleBtn.innerHTML = '📷 Face [M]';
            if (faceDisplay) faceDisplay.style.display = 'none';
            this.setGameMsg('Switched to mouse controls');
        }
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
        if (this.tid321) return; // already counting down
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
        // Always refresh team rosters (NPCs/players may have been added)
        this.world.setPlayerTeams(this.mngrState.red, this.mngrState.blue);
        this.world.players.started = true;

        // Post-countdown setup runs ONCE per game — without this guard,
        // every gameState event after countdown re-randomizes startLineX
        // via setTeamPos, teleporting the camera around.
        if (this.gameSetupDone) return;

        this.ui.showGameDisplay();
        if (this.world.shooting) {
            this.world.shooting.hud.visible = true;
            this.world.shooting.hudLabelObj.visible = true;
        }

        // 3 2 1 still running — wait for it
        if (Date.now() < this.mngrState.startTs) {
            this.show321();
            return;
        }

        // Countdown finished — initial player setup (runs once)
        this.gameSetupDone = true;
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

        // start broadcast + border interval (idempotent — clears existing first)
        this.startUpdateLoop(true);
        this.startBorderLoop(true);

        this.setGameMsg('Press Space to start!');
        this.ui.startFPSCounter();
    }

    //////////////////////////////////////////////////////////
    onGameOver() {
        this.clearPersistentMsg();
        this.setGameMsg('');
        this.ui.showGameOver(this.mngrState.winnerNick, this.mngrState.winnerIsRed);
        if (this.world.shooting) {
            this.world.shooting.hud.visible = false;
            this.world.shooting.hudLabelObj.visible = false;
            // Release any active lock so peers' alarms stop
            this.world.shooting.resetHUD();
        }
        this.moving = false;
        if (this.controls) {
            this.controls.autoForward = false;
            this.controls.enabled = false;
        }
        console.log('*** onGameOver: moving=false, controls disabled');
        this.startUpdateLoop(false);
        this.startBorderLoop(false);
        this.stopWarning();
        if (this.world.sound) {
            this.world.sound.pause();
        }
    }

    //////////////////////////////////////////////////////////
    onMngrState(state) {
        this.tellingGatePass = false;

        this.mngrState = state;
        this.world.setPlayerTeams(state.red, state.blue);

        // host reset triggered from server (returns to lobby)
        if (state.needReset) {
            window.location.href = `/?room=${this.roomId || ''}`;
            return;
        }

        // user is always joined here (lobby ensured team selection before redirect)
        this.world.players.gameJoined = true;

        // game won
        if (state.winnerNick) {
            this.onGameOver();
            return;
        }
        this.ui.hideGameOver();

        // game in progress (always — server starts engine before redirect)
        if (state.started) {
            // Phase A: prepared but not commenced — show pregame overlay, wait
            if (!state.startTs) {
                this.updatePregameUI();
                return;
            }

            // Phase B: commenced — make sure pregame overlay is hidden
            this.updatePregameUI();

            // First state event → run setup (countdown or initial position).
            // Subsequent events → onGameStarted is a no-op thanks to gameSetupDone guard.
            if (!this.gameSetupDone) {
                this.onGameStarted();
                return;
            }

            // Ongoing game update — flag holder transitions
            const holdingFlag = (this.localState.nick === this.mngrState.redHolder || this.localState.nick === this.mngrState.blueHolder);
            this.world.setFlagHolders(holdingFlag, this.localState, this.mngrState);

            if (holdingFlag && !this.holdingFlag) {
                this.setPersistentMsg('Return the flag to your home gate');
                this.playAudio('success');
            } else if (!holdingFlag && this.holdingFlag) {
                const newHolder = this.localState.isRed ? this.mngrState.blueHolder : this.mngrState.redHolder;
                if (newHolder && !this.exploding) {
                    this.setGameMsg(`Flag passed to ${newHolder}`);
                }
                this.clearPersistentMsg();
            }
            this.holdingFlag = holdingFlag;

            if (this.exploding) {
                this.setGameMsg('Flag was dropped during explosion');
                this.tellDropFlag();
            }
        }
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
        this.network.subscribe('roomState', this.onRoomState.bind(this));
        this.network.subscribe('roomClosed', this.onRoomClosed.bind(this));
        // If the player who locked onto us disconnects, the unlock event
        // never arrives — kill the alarm via the playerLeft signal instead.
        this.network.subscribe('playerLeft', (data) => {
            if (data && data.nick && data.nick === this.lockedByNick) {
                this.lockedByNick = null;
                this.stopWarning();
            }
        });
        this.network.subscribe('gameReset', () => {
            // host clicked Play Again — redirect everyone back to the lobby
            window.location.href = '/?room=' + (this.roomId || '');
        });

        // wire pregame Start button (host only — see updatePregameUI)
        const startBtn = document.getElementById('pregame-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.network.commenceGame();
            });
        }
        // pregame Back to Lobby
        const pregameBack = document.getElementById('pregame-back');
        if (pregameBack) {
            pregameBack.addEventListener('click', () => {
                window.location.href = '/?room=' + (this.roomId || '');
            });
        }
        // wire room-closed Back button
        const backBtn = document.getElementById('room-closed-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => { window.location.href = '/'; });
        }

        try {
            const result = await this.network.checkOnline();
            this.onMngrState(result.state);
        } catch (error) {
            console.error(error);
            this.onOffline();
        }
    }

    onRoomState(data) {
        this.hostNick = data.hostNick;
        this.roomId = data.id;
        this.updatePregameUI();
    }

    onRoomClosed(data) {
        const reason = (data && data.reason) || 'The host left the game.';
        const reasonEl = document.getElementById('room-closed-reason');
        if (reasonEl) reasonEl.textContent = reason;
        const overlay = document.getElementById('room-closed-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    updatePregameUI() {
        const overlay = document.getElementById('pregame-overlay');
        if (!overlay) return;
        const startBtn = document.getElementById('pregame-start');
        const messageEl = document.getElementById('pregame-message');

        const inPregame = this.mngrState && this.mngrState.started && !this.mngrState.startTs;
        if (inPregame) {
            overlay.style.display = 'flex';
            const isHost = this.localState.nick === this.hostNick;
            if (startBtn) startBtn.style.display = isHost ? '' : 'none';
            if (messageEl) {
                messageEl.textContent = isHost
                    ? 'When ready, hit Start to begin the countdown.'
                    : `Waiting for ${this.hostNick || 'host'} to start the game…`;
            }
        } else {
            overlay.style.display = 'none';
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

            // Auto-stop after 'dur' attribute (seconds) if set
            const dur = sound.getAttribute('dur');
            if (dur) {
                const ms = parseFloat(dur) * 1000;
                setTimeout(() => this.stopAudio(id), ms);
            }

            let prms = sound.play().catch(() => {});
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
        } finally {
            this.tellingGatePass = false;
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
            const pos = cam.position;
            this.network.broadcastPosition({
                type: "pos",
                nick: this.localState.nick,
                moving: this.moving,
                pos: {
                    x: Math.round(pos.x * 100) / 100,
                    y: Math.round(pos.y * 100) / 100,
                    z: Math.round(pos.z * 100) / 100
                },
                dir: {
                    x: Math.round(this.direction.x * 10000) / 10000,
                    y: Math.round(this.direction.y * 10000) / 10000,
                    z: Math.round(this.direction.z * 10000) / 10000
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
            this.passedThroughHole = false; // track if player was in the actual hole
            return true; // avoid collision check
        }
        // while inside detection sphere, check if in the hole
        if (this.passingGate && gate) {
            if (this.world.isInGateHole(gate)) {
                this.passedThroughHole = true;
            }
            return true; // avoid collision check
        }
        // exit of gate pass
        if (this.passingGate && !gate) {
            console.log(`exit ${this.passingGate.name}, throughHole=${this.passedThroughHole}`);
            // only confirm pass if player actually flew through the hole
            if (this.passedThroughHole) {
                this.passInGate(this.passingGate);
            }
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
        // Always set a max-duration timer. Without this the alarm could loop
        // forever if the unlock event never arrives (locker crashed/disconnected).
        // Re-arming is automatic — every fresh startWarning resets the timer.
        if (this.tidWarning) clearTimeout(this.tidWarning);
        const ttl = manualStop ? 10000 : config.targetLockMs;
        this.tidWarning = setTimeout(() => this.stopWarning(), ttl);
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
        this.lockedByNick = null;
    }

    //////////////////////////////////////////////////////////
    doExplode(msg) {
        this.exploding = true;
        console.log(`*** doExplode: exploding=true, msg=${msg || 'BOOM!!!'}`);
        this.passingGate = null;

        this.stopWarning();
        // Release any active lock so the targeted player's alarm stops
        if (this.world.shooting) this.world.shooting.resetHUD();
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
            console.log('*** return2Start complete: exploding=false');
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
        if (this.exploding) return;
        if (data.targetNick == this.localState.nick) {
            if (data.on) {
                this.lockedByNick = data.nick;
                this.startWarning(`WARNING! ${data.nick} is locking on you!`, true);
            } else if (data.nick === this.lockedByNick) {
                // Only stop if this lockOff is from the same player who locked us
                this.lockedByNick = null;
                this.stopWarning();
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

        // pass the flag to friend (not if they're exploding)
        if (this.world.shooting.friend && this.holdingFlag && !this.world.shooting.targetPlayer.exploding) {
            this.doPassFlag(this.world.shooting.targetPlayer);
            return;
        }

        // block firing at exploding friend while holding flag
        if (this.world.shooting.friend && this.holdingFlag) {
            this.setGameMsg("Can't pass flag — teammate is down!");
            this.playAudio('wrong');
            return;
        }

        // fire enemy
        this.network.sendEvent('player', {
            type: "fire",
            nick: this.localState.nick,
            targetNick: this.world.shooting.targetPlayer.nick
        });

        // reset shooting state after fire
        this.world.shooting.resetHUD();
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
            case "KeyM":
                this.toggleControls();
                break;
            case "KeyS":
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
            console.log('*** collision detected in render loop');
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
