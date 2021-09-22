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
    this.firing = false;
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
      // cant lock on none moving targets
      if(!this.targetPlayer.moving){
        this.setHudColor("#FFFFFF");
        // SIZE
        this.hud.position.z = HUD_Z_NEUTRAL;
        // TEXT
        this.hudLabel.textContent = `can't lock on still target`;
      }else{
        this.setHudOpacity(1);
        // red if emnemy
        // green if pass the flag
        this.setHudColor(this.friend? "#00FF00": "#FF0000");
        // SIZE
        this.hud.position.z = HUD_Z_ACTIVE;
        // TEXT
        const targetName =  this.target.parent.name;
        this.hudLabel.textContent = this.friend? (game.holdingFlag? `Pass the flag to ${targetName}`:"Friendly fire is disabled"): `Locking laser at ${targetName}`;
      }
    }
  }
  //////////////////////////////////////////////
  onNewTarget(target, players) {
    // reset locking
    const wasLocked = this.locked;
    this.locked = false;

    if(this.target){
      // hide bounding sphere
      this.target.material.opacity = 0;
    }
    this.target = target;

    // no target
    if(!target){
      this.friend = false;
      // reset enemy lock
      if(this.tsEnemyLock){
        this.tsEnemyLock = 0;
        // stop laser up either way
        game.stopAudio('laser_up');
        // play lasert down
        if(wasLocked){
          game.playAudio('laser_down');
        }
      }
      return;
    }
    // get wrapping player class
    this.targetPlayer = players.getPlayer(this.target.parent.name);

    // set friend
    this.friend = this.isRed === this.targetPlayer.isRed;

    // start locking if enemy
    this.tsEnemyLock = this.friend? 0 : Date.now();


    // update hud
    //console.log('on new target:', this.targetPlayer.nick);
    // dont lock on exploding target (or not moving TODO:)
    // not moving or exploding - DO NOTHING
    //console.log(`target moving: ${this.targetPlayer.moving}`)
    if(!this.targetPlayer.moving || this.targetPlayer.exploding){
      this.tsEnemyLock = 0;
      return;
    }

    // lock for pass the flag
    if(this.friend && game.holdingFlag){
      game.playAudio('locked');
      return; // no need to continue for enemy locking
    }

    // play load laser sound
    if(this.tsEnemyLock){
      // target bounding sphere visible
      this.target.material.opacity = 0.5;

      game.stopAudio('laser_down');
      game.playAudio('laser_up');
    }
  }
  //////////////////////////////////////////////
  updateLock() {
    // target locking
    if(this.tsEnemyLock){
      if (!this.locked){
        // update locking state
        const diff = Date.now() - this.tsEnemyLock;
        this.locked = diff > config.targetLockMs;
        if(!this.locked){
          const countdown = parseInt((config.targetLockMs-diff)/100);
          this.hudLabel.textContent = "[locking] " + countdown;
          // rotate while locking
          this.hud.rotateZ(diff/(config.targetLockMs * 5));
          // update target being locked on
          // TODO : Continue
          // if(!this.targetPlayer.lockignSent && diff > config.lockingSentBuffer){
          //   this.targetPlayer.lockignSent = true;
          // }
        }
        else{
          this.hudLabel.textContent = "Target locked!"
          game.stopAudio('laser_up');
          game.playAudio('locked');
          this.hud.rotation.z = 0;
        }
      }
    }// locked!
    else{
      this.hudLabel.textContent = game.localState.nick;
    }
  }
  //////////////////////////////////////////////
  update(raycaster, players) {
    if(!game.moving) return;
    if(game.exploding) return;
    if(this.firing) return;

    raycaster.near = config.targetNear;
    raycaster.far = config.targetFar;

    const spheres = players.boundSpheres();
    const intersections = raycaster.intersectObjects(spheres);
    let target;
    if(intersections.length){
      target = intersections[0].object;
      //console.log(this.target.name, intersections[0].distance);//, dis);
      // target changed
    }

    if(target != this.target){
      this.onNewTarget(target, players);
      this.changeHudState();
    }

    if(target){
      // locking
      if(this.tsEnemyLock){
        this.updateLock();
      }
    }
  }
}
