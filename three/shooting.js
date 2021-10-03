//////////////////////////////////////////////
const HUD_Z_NEUTRAL = -0.7;
const HUD_Z_ACTIVE = -1;
//////////////////////////////////////////////
class Shooting {
  //////////////////////////////////////////////
  constructor() {
    //this.raycaster = new THREE.Raycaster();
    this.isRed = "uninitialized!!!";
    this.friend = false;
  }
  //////////////////////////////////////////////
  createHUD(){
    const hud = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      hud.add(new THREE.Mesh(new THREE.RingGeometry(0.045, 0.055, 128, 1, hPi * i + 0.2, hPi - 0.4), new THREE.LineBasicMaterial({color: `#ffffff`, transparent:true, opacity:0.1})))
    }
    hud.position.set( 0, 0, HUD_Z_NEUTRAL );
    this.hud = hud;

    const label = document.createElement( 'div' );
    label.className = 'hud-label';
    label.textContent = game.localState.nick;
    //label.style.color = isRed ? '#F33':'33F';
    label.style.color = '#FFF';
    const obj = new THREE.CSS2DObject( label );
    obj.position.set( 0, 0, 0 );
    this.hud.add( obj );
    this.hudLabel = label;

    return hud;
  }
  //////////////////////////////////////////////
  setHudColor(color) {
    for( let child of this.hud.children){
      if(child.material)
        child.material.color.set(color);
    }
    this.hudLabel.style.color = color;
  }
  //////////////////////////////////////////////
  setHudOpacity(opacity) {
    for( let child of this.hud.children){
      if(child.material)
        child.material.opacity = opacity;
    }
    this.hudLabel.style.opacity = opacity;
  }
  //////////////////////////////////////////////
  broadcastLock(flag) {
    deepStream.sendEvent('player',{
      type:"lockOn",
      on:flag,
      nick: game.localState.nick,
      targetNick: this.targetPlayer.nick,
      // new
      targetTS: Date.now()
    });
  }
  isInRange(dis, min, max){
    if(dis < min){
			this.rangeDelta = dis - min;
			return false;
		}
		if(dis > max){
			this.rangeDelta = dis - max;
			return false;
		}
		return true;
  }
  //////////////////////////////////////////////
  onNewTarget(target, players) {
    // REMINDER 'target' is the sphere THREEJS mesh object

		// reset locking
		game.stopAudio('laser_up');
		this.tsEnemyLock = 0;

    // locking off old target
    if(this.target){
			// hide sphere
			this.target.material.opacity = 0;
			// release lock
			if(this.locked){
				// hide bounding sphere
				this.broadcastLock(false);
				// sound
				game.stopAudio('laser_up');
				game.playAudio('laser_down');
				this.lock = false
			}
    }

		// release locked
		this.locked = false;

		// update current target
    this.target = target;

		if(target){
			// get wrapping player class
			this.targetPlayer = players.getPlayer(this.target.parent.name);
			// set friend
			this.friend = this.isRed === this.targetPlayer.isRed;
		}
    // no target
    // else{
    //   this.friend = false;
    //   // reset enemy lock
    //   if(this.tsEnemyLock){
    //     this.tsEnemyLock = 0;
    //     // stop laser up either way
    //     game.stopAudio('laser_up');
    //     // play lasert down
    //     if(wasLocked){

    //     }
    //   }
    //   return;
    // }
  }
  //////////////////////////////////////////////
  updateLock() {
    // target locking
		if (!this.locked){
			// update locking state
			const diff = Date.now() - this.tsEnemyLock;
			this.locked = diff > config.targetLockMs;
			if(!this.locked){
				const countdown = parseInt((config.targetLockMs-diff)/100);
				this.hudLabel.textContent = "[locking] " + countdown;
				// rotate while locking
				this.hud.rotateZ(diff/(config.targetLockMs * 5));

			}
			else{
				this.hudLabel.textContent = "Target locked!"
				game.stopAudio('laser_up');
				game.playAudio('locked');
				this.hud.rotation.z = 0;
			}
    }
  }
  //////////////////////////////////////////////
  checkTargetRange(){
    ////////////////////////////////
    // handle ranges and lockTS

    // pass flag
    if(this.friend){
      //this.tsEnemyLock = 0; // no lock
      this.inRange = this.isInRange(this.target.distance, config.passNear, config.passFar);
    }
    // shooting
    else {
      this.inRange = this.isInRange(this.target.distance, config.shootNear, config.shootFar);
      // if(this.targetPlayer.inRange){
      //   this.tsEnemyLock = Date.now();
      // }
    }
	}
  //////////////////////////////////////////////
  update(raycaster, players) {
    if(!game.moving) return;
    if(game.exploding) return;
    if(game.firing) return;

    // use those later
    // raycaster.near = config.targetNear;
    // raycaster.far = config.targetFar;

    const spheres = players.boundSpheres();
    const intersections = raycaster.intersectObjects(spheres);
    let target = null;
    if(intersections.length){
      target = intersections[0].object;
      target.distance = intersections[0].distance;
      //console.log(this.target.name, intersections[0].distance);//, dis);
      // target changed
    }

		// is Target changed
    if(target != this.target){
      // ignore invisible
      if(!target || target.visible){
      	this.onNewTarget(target, players);
				this.changeHudState();
			}
    }
		// same target as before
		else{
			// No target do nothing
			if(!target) return;
			// ignore exploding targets
			if(this.targetPlayer.exploding) return;
			// ignore still targets
			if(!game.stillTargetEnabled && !this.targetPlayer.moving){
				this.hudLabel.textContent = `can't lock on still target`;
				return;
			}

			// already locking on enemy? continue
			if(this.tsEnemyLock){
				this.updateLock();
				return;
			}

			// already locked (on friend only)
			if(this.locked) return;

			// set inRange for both friend or enemy
			this.checkTargetRange();
			if(this.inRange){
				// show sphere (hide upon new target)
				this.target.material.opacity = 0.5;
				// update enemy/friend
				if(this.friend){
					if(game.holdingFlag){
						this.locked = true;
						this.hudLabel.textContent = `Pass the flag to ${this.targetPlayer.nick}`
						game.stopAudio('laser_up');
						game.stopAudio('laser_down');
						game.playAudio('locked');
					}
					else{
						this.hudLabel.textContent = `friendly fire is disabled!`;
					}
				}
				else{
					// start locking for next time
					this.tsEnemyLock = Date.now();
					game.stopAudio('laser_down');
					game.playAudio('laser_up');

					this.broadcastLock(true);
				}
			}else{
				// set out of range message
				this.hudLabel.textContent = `${this.targetPlayer.nick} is out of range (${this.rangeDelta.toFixed(1)})`;
			}
		}
  }
	//////////////////////////////////////////////
  changeHudState() {
    this.setHudOpacity(0.3);
    // neutral
    if(!this.target){
      // COLOR
      this.setHudColor("#FFFFFF");
      // SIZE
      this.hud.position.z = HUD_Z_NEUTRAL;
      // TEXT
      this.hudLabel.textContent = game.localState.nick;
    }
    else{
			this.setHudOpacity(1);
			// red if emnemy
			// green if pass the flag
			this.setHudColor(this.friend? "#00FF00": "#FF0000");
			// SIZE
			this.hud.position.z = HUD_Z_ACTIVE;
			// TEXT
			const targetName =  this.targetPlayer.nick;
    }
  }
}
