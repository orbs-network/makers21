//////////////////////////////////////////////
const HUD_Z_NEUTRAL = -0.7;
const HUD_Z_ACTIVE = -1;
const hPi = 0.5 * Math.PI;
//////////////////////////////////////////////
class Shooting {
  //////////////////////////////////////////////
  constructor() {
    //this.raycaster = new THREE.Raycaster();
    this.isRed = null;
    this.friend = false;
  }
  //////////////////////////////////////////////
  createHUD() {
    const hud = new THREE.Group();
    const ringMat = () => new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1 });
    for (let i = 0; i < 4; i++) {
      hud.add(new THREE.Mesh(new THREE.RingGeometry(0.025, 0.03, 128, 1, hPi * i + 0.2, hPi - 0.4), ringMat()));
    }

    // Crosshair lines (hidden until locked)
    const crossMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
    const crossSize = 0.012;
    const gap = 0.004;
    const makeLineGeo = (x1, y1, x2, y2) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([x1, y1, 0, x2, y2, 0], 3));
      return g;
    };
    this.crosshairs = [
      new THREE.Line(makeLineGeo(-crossSize, 0, -gap, 0), crossMat.clone()),
      new THREE.Line(makeLineGeo(gap, 0, crossSize, 0), crossMat.clone()),
      new THREE.Line(makeLineGeo(0, -crossSize, 0, -gap), crossMat.clone()),
      new THREE.Line(makeLineGeo(0, gap, 0, crossSize), crossMat.clone()),
    ];
    this.crosshairs.forEach(c => hud.add(c));

    hud.position.set(0, 0, HUD_Z_NEUTRAL);
    this.hud = hud;

    const label = document.createElement('div');
    label.className = 'hud-label';
    const teamDot = game.localState.isRed ? '🔴' : '🔵';
    label.textContent = `${teamDot} ${game.localState.nick}`;
    label.style.color = '#FFF';
    const obj = new THREE.CSS2DObject(label);
    obj.position.set(0, 0, 0);
    obj.visible = false;
    this.hud.add(obj);
    this.hudLabelObj = obj;
    this.hudLabel = label;

    return hud;
  }
  //////////////////////////////////////////////
  setHudColor(color) {
    for (let child of this.hud.children) {
      if (child.material)
        child.material.color.set(color);
    }
    this.hudLabel.style.color = color;
  }
  //////////////////////////////////////////////
  setHudOpacity(opacity) {
    for (let child of this.hud.children) {
      if (child.material)
        child.material.opacity = opacity;
    }
    this.hudLabel.style.opacity = opacity;
  }
  //////////////////////////////////////////////
  setCrosshairVisible(visible) {
    this.crosshairs.forEach(c => { c.material.opacity = visible ? 1 : 0; });
  }
  //////////////////////////////////////////////
  setRingThickness(thick) {
    // Swap ring geometry between normal and thick
    const inner = thick ? 0.022 : 0.025;
    const outer = thick ? 0.035 : 0.03;
    this.hud.children.forEach((child, i) => {
      if (i < 4 && child.geometry) {
        child.geometry.dispose();
        child.geometry = new THREE.RingGeometry(inner, outer, 128, 1, hPi * i + 0.2, hPi - 0.4);
      }
    });
  }
  //////////////////////////////////////////////
  broadcastLock(flag) {
    game.network.sendEvent('player', {
      type: "lockOn",
      on: flag,
      nick: game.localState.nick,
      targetNick: this.targetPlayer?.nick,
      // new
      targetTS: Date.now()
    });
  }
  isInRange(dis, min, max) {
    if (dis < min) {
      this.rangeDelta = dis - min;
      return false;
    }
    if (dis > max) {
      this.rangeDelta = dis - max;
      return false;
    }
    return true;
  }
  //////////////////////////////////////////////
  onNewTarget(target, players) {
    this.tidNewTarget = 0; // reset async proc

    // Validate target is still valid (may have gone stale during debounce)
    if (target && (!target.visible && target.material?.opacity === 0)) {
      target = null;
    }

    // REMINDER 'target' is the sphere THREEJS mesh object
    // hide bounding sphere for others
    this.broadcastLock(false);

    // reset locking
    game.stopAudio('laser_up');
    this.tsEnemyLock = 0;

    // locking off old target
    if (this.targetPlayer) {
      // hide sphere
      this.targetPlayer.showBoundingSphere(false);

      // release lock — skip sound if we just fired (avoid double beep)
      if (this.locked && !game.firing) {
        game.stopAudio('laser_up');
        game.playAudio('laser_down');
      }
      this.locked = false;
    }

    // release locked
    this.locked = false;

    // update current target
    this.target = target;

    if (target) {
      // get wrapping player class
      this.targetPlayer = players.getPlayer(this.target.parent.name);
      // set friend
      this.friend = this.isRed === this.targetPlayer.isRed;
    }
  }
  //////////////////////////////////////////////
  updateLock() {
    // target locking
    if (!this.locked) {
      // update locking state
      const diff = Date.now() - this.tsEnemyLock;
      this.locked = diff > config.targetLockMs;
      if (!this.locked) {
        const countdown = parseInt((config.targetLockMs - diff) / 100);
        this.hudLabel.textContent = "[locking] " + countdown;
        // rotate while locking
        this.hud.rotateZ(diff / (config.targetLockMs * 5));

      } else {
        this.hudLabel.textContent = "FIRE [F]"
        game.stopAudio('laser_up');
        game.playAudio('locked');
        this.hud.rotation.z = 0;
        this.setRingThickness(true);
        this.setCrosshairVisible(true);
      }
    }
  }
  //////////////////////////////////////////////
  checkTargetRange() {
    // pass flag
    if (this.friend) {
      this.inRange = this.isInRange(this.target.distance, config.passFlagNear, config.passFlagFar);
    }
    // shooting
    else {
      this.inRange = this.isInRange(this.target.distance, config.shootNear, config.shootFar);
    }
  }
  //////////////////////////////////////////////
  update(raycaster, players) {
    if (this.isRed === null) return;
    if (game.exploding) return;
    if (game.firing) return;

    // Allow lock timer to keep counting even when stopped
    if (!game.moving) {
      if (this.tsEnemyLock) {
        this.updateLock();
      }
      return;
    }

    // use those later
    //raycaster.near = config.raycastNear;
    //raycaster.far = config.raycastFar;


    const spheres = players.boundSpheres();
    const intersections = raycaster.intersectObjects(spheres);
    let target = null;
    if (intersections.length) {
      target = intersections[0].object;
      target.distance = intersections[0].distance;
      //console.log('raycase', target.name, intersections[0].distance); //, dis);
      // target changed
    }

    // is Target changed
    if (target != this.target) {
      // ignore invisible
      if (!target || target.visible) {
        if (!this.tidNewTarget){
          this.tidNewTarget = setTimeout(()=>{
            this.onNewTarget(target, players);
            this.changeHudState();
          }, config.newTargetDelay);
        }
      }
    }
    // same target as before
    else {
      if(this.tidNewTarget){
        clearTimeout(this.tidNewTarget);
      }
      this.tidNewTarget = 0;
      // No target do nothing
      if (!target) return;
      // ignore exploding targets
      if (this.targetPlayer && this.targetPlayer.exploding) return;
      // ignore still targets
      if (!game.stillTargetEnabled && !this.targetPlayer.moving) {
        this.hudLabel.textContent = `can't lock on still target`;
        return;
      }

      // already locking on enemy? continue
      if (this.tsEnemyLock) {
        this.updateLock();
        return;
      }

      // already locked (on friend only)
      if (this.locked) return;

      // set inRange for both friend or enemy
      this.checkTargetRange();
      if (this.inRange) {
        // show sphere (hide upon new target)
        this.targetPlayer.showBoundingSphere(true);
        // update enemy/friend
        if (this.friend) {
          if (game.holdingFlag) {
            this.locked = true;
            this.hudLabel.textContent = `Pass the flag to ${this.targetPlayer.nick}`
            game.stopAudio('laser_up');
            game.stopAudio('laser_down');
            game.playAudio('locked');
          } else {
            this.hudLabel.textContent = `friendly fire is disabled!`;
          }
        } else {
          // start locking for next time
          this.tsEnemyLock = Date.now();
          game.stopAudio('laser_down');
          game.playAudio('laser_up');

          this.broadcastLock(true);
        }
      } else {
        // set out of range message
        this.hudLabel.textContent = `${this.targetPlayer.nick} is out of range (${this.rangeDelta.toFixed(1)})`;
      }
    }
  }
  //////////////////////////////////////////////
  resetHUD() {
    // Tell any peer we were locking onto that we're no longer aiming —
    // otherwise their alarm loops forever (audio element has loop=true).
    if (this.targetPlayer) {
      this.broadcastLock(false);
      this.targetPlayer.showBoundingSphere(false);
    }
    this.tsEnemyLock = 0;
    this.target = null;
    this.targetPlayer = null;
    this.locked = false;
    this.changeHudState();
  }
  //////////////////////////////////////////////
  changeHudState() {
    this.setHudOpacity(0.3);
    // reset locked state visuals
    this.setRingThickness(false);
    this.setCrosshairVisible(false);
    // neutral
    if (!this.target) {
      // COLOR
      this.setHudColor("#FFFFFF");
      // SIZE
      this.hud.position.z = HUD_Z_NEUTRAL;
      // TEXT
      const teamDot = game.localState.isRed ? '🔴' : '🔵';
      this.hudLabel.textContent = `${teamDot} ${game.localState.nick}`;
    } else {
      this.setHudOpacity(1);
      // red if emnemy
      // green if pass the flag
      this.setHudColor(this.friend ? "#00FF00" : "#FF0000");
      // SIZE
      this.hud.position.z = HUD_Z_ACTIVE;
    }
  }
}

window.Shooting = Shooting;