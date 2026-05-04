const lookDistance = SIZE * 2; // WAS 1000 - NEED TO CHECK

//////////////////////////////////////////////////////////
class Player {
  //////////////////////////////////////////////////////////
  constructor(obj, nick, isRed, sound, useShooting) {
    this.obj = obj;
    this.moving = false;
    this.isRed = isRed;
    this.inGame = true; // constructor is called when in game
    this.nick = nick;
    this.lastPosTS = 0;
    this._initLabel(nick, isRed);

    // create sounds
    if (sound) { // might be undefined when players added before user started flying
      this.addSound(sound);
    }
    // DO BEFORE SHOOTING SO IT DOESNT REPLACE ADDED SPHERE MATTERIAL
    this.setMaterialColor(isRed);

    // useShooting
    this.useShooting = useShooting;
    if (useShooting) {
      // bounding sphere
      const geometry = new THREE.SphereGeometry(320 * config.playSphereFactor, 16, 8);
      // create new matterial per sphere so opacity can be changed individually
      this.boundSphere = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
        color: isRed ? 0xFF0000 : 0x0000FF,
        depthWrite: false,
      }));
      this.boundSphere.layers.enable(1); // MUST
      this.boundSphere.material.transparent = true;
      //this.boundSphere.position.z = 90;
      this.boundSphere.name = nick + '_bound_sphere';
      //this.boundSphere.scale.set(2400,2400,2400);
      this.boundSphere.material.opacity = 0;
      this.obj.add(this.boundSphere);
      // lasser beam
      const laserBeam = new THREEx.LaserBeam();
      this.obj.add(laserBeam.object3d);
      laserBeam.object3d.visible = false;
      laserBeam.object3d.rotateY(THREE.MathUtils.degToRad(90));
      laserBeam.object3d.position.z = -.05; // infront of airplane
      this.laserBeam = laserBeam;
    }

    // SUPER SIMPLE GLOW EFFECT
    // use sprite because it appears the same from all angles
    const textureLoader = new THREE.TextureLoader();
    const engineMaterial = new THREE.SpriteMaterial({
      map: textureLoader.load('assets/images/nova_1.png'),
      depthWrite: false,
      color: isRed ? 0xffaaaa : 0x9999ff,
      blending: THREE.AdditiveBlending
    });

    const engineSprite = new THREE.Sprite(engineMaterial);
    engineSprite.scale.set(300, 300, 1.0);
    engineSprite.position.z = -180;
    engineSprite.position.x = -30;
    obj.add(engineSprite);

  }
  //////////////////////////////////////////////////////////
  showBoundingSphere(show) {
    this.boundSphere.material.opacity = show ? 0.3 : 0;
  }
  //////////////////////////////////////////////////////////
  setMaterialColor(red) {
    this.obj.children[0].material.emissive.set(red ? RED_SHIP : BLUE_SHIP);
  }
  //////////////////////////////////////////////////////////
  addSound(sound) {
    // refDistance doubled — fly-by audible from twice the previous range.
    // 6th arg = duration: loops back to start at 15s instead of playing
    // the whole tail of the WAV.
    sound.add('fly-by.wav', this.obj, true, (config.size / 5) * 2, undefined, 15);
    sound.add('explode.wav', this.obj, false, config.size / 2, 1);
    sound.add('laser.wav', this.obj, false, config.size / 5, 1);
    sound.add('laser_up.wav', this.obj, false, config.size / 5, 1);
    sound.add('laser_down.wav', this.obj, false, config.size / 5, 1);
  }
  //////////////////////////////////////////////////////////
  update(delta) {
    if (!this.moving) return;

    const speed = config.distancePerMS;

    // Determine steering direction
    if (this.targetPos) {
      // Vector from current position to target
      const toTarget = this._toTarget || (this._toTarget = new THREE.Vector3());
      toTarget.set(
        this.targetPos.x - this.obj.position.x,
        this.targetPos.y - this.obj.position.y,
        this.targetPos.z - this.obj.position.z
      );
      const dist = toTarget.length();

      if (dist > 0.1) {
        // Steer toward target position — blend rate based on distance
        // Far away: steer harder. Close: rely more on targetDir for look
        const steerBlend = Math.min(dist * 0.003, 0.12) * (delta / 16);
        toTarget.normalize();
        this.dir.lerp(toTarget, steerBlend).normalize();
      } else {
        // Close enough to target — steer toward look direction
        this.dir.lerp(this.targetDir, 0.06 * (delta / 16)).normalize();
      }
    } else if (this.targetDir) {
      this.dir.lerp(this.targetDir, 0.06 * (delta / 16)).normalize();
    }

    // Always move forward at constant speed
    this.obj.position.x += this.dir.x * speed * delta;
    this.obj.position.y += this.dir.y * speed * delta;
    this.obj.position.z += this.dir.z * speed * delta;

    // Apply direction
    this.obj.lookAt(
      this.obj.position.x + this.dir.x * lookDistance,
      this.obj.position.y + this.dir.y * lookDistance,
      this.obj.position.z + this.dir.z * lookDistance
    );
  }
  //////////////////////////////////////////////////////////
  hadPos() {
    // return false if all zero
    return (this.obj.position.x || this.obj.position.y || this.obj.position.z);
  }
  //////////////////////////////////////////////////////////
  onPos(data) {
    // reject bad position data
    if (!data.pos || !isFinite(data.pos.x) || !isFinite(data.pos.y) || !isFinite(data.pos.z)) return;
    if (!data.dir || !isFinite(data.dir.x) || !isFinite(data.dir.y) || !isFinite(data.dir.z)) return;

    const wasMoving = this.moving;
    this.moving = data.moving;

    // necesseraly
    this.exploding = false;
    this.show();

    // Initialize direction on first update
    if (!this.dir) this.dir = new THREE.Vector3();

    // Always update position and direction from server data
    if (!this.targetPos) this.targetPos = new THREE.Vector3();
    if (!this.targetDir) this.targetDir = new THREE.Vector3();

    this.targetPos.set(data.pos.x, data.pos.y, data.pos.z);
    this.targetDir.set(data.dir.x, data.dir.y, data.dir.z).normalize();

    // Not moving or first position — snap immediately
    if (!this.moving || !this.hadPos()) {
      this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
      this.dir.copy(this.targetDir);
      this.obj.lookAt(
        this.obj.position.x + this.dir.x * lookDistance,
        this.obj.position.y + this.dir.y * lookDistance,
        this.obj.position.z + this.dir.z * lookDistance
      );
      return;
    }

    // Just started moving — snap to position first, then steer from here
    if (!wasMoving && this.moving) {
      this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
      this.dir.copy(this.targetDir);
      return;
    }
  }
  //////////////////////////////////////////////////////////
  onExplode(data, explode) {
    this.exploding = data.flag;

    // finished exploding
    if (!this.exploding) {
      this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
      this.obj.rotation.set(data.dir.x, data.dir.y, data.dir.z);
      this.show(true);
      return;
    }

    // abort future lockOff
    if (this.tidLock) {
      clearTimeout(this.tidLock);
      this.tidLock = 0;
    }

    // hide exploding airplaine
    this.moving = false;
    // hide exploding
    this.show(false);
    // show again after return to start
    if (this.tidWaitReturn) {
      clearTimeout(this.tidWaitReturn);
    }
    // this.tidWaitReturn = setTimeout(()=>{
    //   this.tidWaitReturn = 0;
    //   this.show(true)
    // },config.return2startSec * 1000)

    // create explosition attached to player
    explode.create(this.obj.position.x, this.obj.position.y, this.obj.position.z, this.isRed);

    // for positional sound
    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);

    // play already installed sound
    let sound = this.obj.getObjectByName('sound_explode.wav');
    if (sound) try { sound.play(); } catch (e) { }
  }
  //////////////////////////////////////////////////////////
  onFire(data) {
    // abort future lockOff
    if (this.tidLock) {
      clearTimeout(this.tidLock);
      this.tidLock = 0;
    }
    // play already installed sound
    let sound = this.obj.getObjectByName('sound_laser.wav');
    if (sound) try { sound.play(); } catch (e) { }

    this.laserBeam.object3d.visible = true;
    // auto hide
    if (this.tidHideFire) {
      clearTimeout(this.tidHideFire);
    }
    this.tidHideFire = setTimeout(() => {
      this.laserBeam.object3d.visible = false;
      this.tidHideFire = null;
    }, 200);
  }
  //////////////////////////////////////////////////////////
  onLockOn(data, target) {
    // play already installed sound
    let sound = this.obj.getObjectByName('laser_up.wav');
    if (sound) try { sound.play(); } catch (e) { }

    // auto-hide sphere after lock timeout (safety net)
    if (this.tidLock) clearTimeout(this.tidLock);
    this.tidLock = setTimeout(() => {
      this.onLockOff(data, target);
      // hide sphere on the target being locked onto
      if (target && target.boundSphere) {
        target.showBoundingSphere(false);
      }
      this.tidLock = 0;
    }, config.targetLockMs + 500) // slightly longer than lock duration

  }
  //////////////////////////////////////////////////////////
  onLockOff(data, target) {
    // play already installed sound
    let sound = this.obj.getObjectByName('laser_down.wav');
    if (sound) try { sound.play(); } catch (e) { }
    // hide sphere on target
    if (target && target.boundSphere) {
      target.showBoundingSphere(false);
    }
  }
  //////////////////////////////////////////////////////////
  onLock(data, target) {
    if (data.on) {
      this.onLockOn(data, target);
    } else {
      this.onLockOff(data, target);
    }
    if (target) {
      target.showBoundingSphere(data.on);
    }
  }
  //////////////////////////////////////////////////////////
  show(flag) {
    // explicit hide
    if (flag !== false) flag = true;
    this.obj.visible = flag;
    this.playerLabelObj.visible = flag;
  }
  //////////////////////////////////////////////////////////
  _initLabel(nick, isRed) {
    const playerLabelDiv = document.createElement('div');
    playerLabelDiv.className = 'player-label';
    playerLabelDiv.textContent = nick || "WHO DIS?";
    playerLabelDiv.style.color = isRed ? 'rgb(200, 0, 0)' : 'rgb(0, 128, 255)';
    playerLabelDiv.style.textShadow = '0 0 4px #000, 0 0 8px #000, 0 0 12px #000';
    this.playerLabelDiv = playerLabelDiv;
    this.playerLabelObj = new THREE.CSS2DObject(playerLabelDiv);
    this.playerLabelObj.position.set(0, 0, 0);
    this.obj.add(this.playerLabelObj);
  }
  //////////////////////////////////////////////////////////
  showFlagIcon(flagColor) {
    // flagColor: 'red', 'blue', or null to hide
    if (!this.playerLabelDiv) return;
    if (flagColor) {
      const color = flagColor === 'red' ? '#F00' : '#00F';
      this.playerLabelDiv.innerHTML = `<span style="color:${color}">&#9873;</span> ${this.nick}`;
    } else {
      this.playerLabelDiv.textContent = this.nick;
    }
  }
}

class Players {
  //////////////////////////////////////////////////////////
  constructor(world) {
    this.dict = {};
    this.world = world;
    this.model = world.models['airplane'];

    this.useShooting = false;

    window.networkService.subscribe("player", this.onEvent.bind(this));

  }
  //////////////////////////////////////////////////////////
  reset() {
    for (let nick in this.dict) {
      let p = this.dict[nick];
      // reset
      p.inGame = false;
      p.moving = false;
      p.exploding = false;
      p.go2Target = false;
      if (p.tidLock) {
        clearTimeout(p.tidLock);
        p.tidLock = 0;
      }
      // clear bounding sphere from previous lock-on
      if (p.boundSphere) {
        p.boundSphere.material.opacity = 0;
      }
      // hide from scene
      p.show(false);
    }
  }
  //////////////////////////////////////////////////////////
  setTeams(red, blue) {
    this.red = red;
    this.blue = blue;

    // mark all players if they are ingame or not
    for (let nick in this.dict) {
      this.dict[nick].inGame = red.includes(nick) || blue.includes(nick);
    }

  }
  //////////////////////////////////////////////////////////
  onEvent(data) {
    // ignore all events fly events if game hasnt started
    if (!this.gameJoined) {
      return;
    }
    const p = this.getPlayer(data.nick);

    if (!p || !p.inGame) {
      console.log(`Player ${data.id} ${data.nick} not in this game`); // ignore
      return;
    }

    //  if(data.targetPos)    console.log(`event type:${data.type}`,data.targetPos);

    switch (data.type) {
      // case "start":
      //   p.onStart(data);
      //   break;
      case "pos":
        p.onPos(data);
        break;
      case "explode":
        p.onExplode(data, this.world.explode);
        game.setGameMsg(`${data.nick} got exploded`);
        break;
      case "fire":
        p.onFire(data);
        // explode myself if im the target
        game.checkFireTarget(data);
        break;
      case "lockOn":
        p.onLock(data, this.getPlayer(data.targetNick));
        // warn myself if im the target
        game.checkLockOnTarget(data);
        break;

    }
  }
  //////////////////////////////////////////////////////////
  update(delta) {
    for (let nick in this.dict) {
      this.dict[nick].update(delta);
    }
  }
  //////////////////////////////////////////////////////////
  updateFlagIcons(redHolder, blueHolder) {
    for (const nick in this.dict) {
      const p = this.dict[nick];
      if (nick === redHolder) {
        p.showFlagIcon('red');
      } else if (nick === blueHolder) {
        p.showFlagIcon('blue');
      } else {
        p.showFlagIcon(null);
      }
    }
  }
  //////////////////////////////////////////////////////////
  checkIsRed(nick) {
    if (this.red?.includes(nick)) return 1;
    if (this.blue?.includes(nick)) return -1;
    return 0;
  }
  //////////////////////////////////////////////////////////
  setNick(nick) {
    this.myNick = nick;
  }
  //////////////////////////////////////////////////////////
  createNew(nick) {
    if (nick === this.myNick) {
      console.error('must be another tab/player with identical nick', nick);
      return;
    }
    // return null if not in either team
    const isRed = this.checkIsRed(nick);
    if (!isRed) {
      console.error('SHOULDNT HAPPEN!')
      console.log(`${nick} wasnt found in either team`);
      console.log('blue team:', this.blue.join());
      console.log('red  team:', this.red.join());
      return null;
    }
    let p = new THREE.Object3D();

    // copy entire model
    p.copy(this.model);

    // scale
    const s = GATE_SIZE / 500;// was 30000 but adjusted to ship model
    p.scale.set(s, s, s);

    p.name = nick;

    this.world.scene.add(p);
    p.castShadow = true;
    let newPlayer = new Player(p, nick, (isRed === 1), this.sound, this.useShooting);

    this.dict[nick] = newPlayer;
    console.log('create player', nick);
    return newPlayer;
  }
  //////////////////////////////////////////////////////////
  all() {
    let all = [];
    for (let nick in this.dict) {
      all.push(this.dict[nick].obj);
    }
    return all;
  }
  //////////////////////////////////////////////////////////
  boundSpheres() {
    let all = [];
    for (let nick in this.dict) {
      if (this.dict[nick].boundSphere) {
        all.push(this.dict[nick].boundSphere);
      }
    }
    return all;
  }
  //////////////////////////////////////////////////////////
  initSound(sound) {
    this.sound = sound;
    for (let nick in this.dict) {
      this.dict[nick].addSound(sound);
    }
  }
  //////////////////////////////////////////////////////////
  getPlayer(nick) {
    // this player
    if (nick === game.localState.nick)
      return null;

    // ignore platers not in game
    if (!this.red.includes(nick) && !this.blue.includes(nick))
      return null;

    const p = this.dict[nick];
    if (p) {
      return p;
    }
    return this.createNew(nick);
  }
  //////////////////////////////////////////////////////////
  initShooting(enabled) {
    this.useShooting = enabled;
  }
  //////////////////////////////////////////////////////////
  // Memory management - dispose of player resources
  dispose() {
    for (const nick in this.dict) {
      const player = this.dict[nick];
      if (player.obj) {
        player.obj.traverse((object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((m) => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
    }
    this.dict = {};
    console.log('Players resources disposed');
  }
}
window.Players = Players;
