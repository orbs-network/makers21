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
    hud.position.set( 0, 0, -0.7 );
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
  setHudState() {
    this.setHudOpacity(this.target? 1: 0.3);
    // neutral
    if(!this.target){
      this.setHudColor("#FFFFFF");
      // SIZE
      this.hud.position.z += 0.3;
      // TEXT
      this.hudLabel.textContent = game.localState.nick;
    }
    else{
      // red if emnemy
      // green if pass the flag
      this.setHudColor(this.friend? "#00FF00": "#FF0000");
      // TEXT
      this.hudLabel.textContent = this.friend? (game.holdingFlag? "Pass the flag":"Friendly fire disabled"): "Locking laser at "+ this.target.parent.name;
      // SIZE
      this.hud.position.z -= 0.3;
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
    // update hud
    this.setHudState()
    // no target
    if(!target){
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
    this.friend = this.isRed == this.target.isRed;
    this.tsEnemyLock = this.friend? 0 : Date.now();

    this.targetPlayer = players.getPlayer(this.target.parent.name);
    console.log('on new target:', this.targetPlayer.nick);

    // target bounding sphere visible
    this.target.material.opacity = 0.3;

    // play load laser sound
    if(this.tsEnemyLock){
      game.stopAudio('laser_down');
      game.playAudio('laser_up');
    }
  }
  //////////////////////////////////////////////
  update(raycaster, players) {
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
      return;
    }

    // target locking
    if(this.tsEnemyLock){
      if (!this.locked){
        const diff = Date.now() - this.tsEnemyLock;
        this.locked = diff > config.targetLockMs;
        if(!this.locked){
          const countdown = parseInt((config.targetLockMs-diff)/100);
          this.hudLabel.textContent = "[locking] " + countdown;
          // rotate while locking
          this.hud.rotateZ(diff/(config.targetLockMs*5));
        }
        else{
          this.hudLabel.textContent = "Target locked!"
          game.stopAudio('laser_up');
          game.playAudio('locked');
          this.hud.rotation.z = 0;
        }
      }
    }
    else{
      this.hudLabel.textContent = game.localState.nick;
    }


    // highlight target boxe
    // for( let s of spheres ) {
    //   s.material.opacity = (this.target && s.name === this.target.name)? 0.3:0;
    // }

    //const laserHit = intersections.find(i => i.distance < 10);
    // if (laserHit) {
    //   if (this.laserLockingObj === laserHit.object) {
    //     if (Date.now() - this.laserLockingTimestamp > LOCKING_TIME) {
    //       laserHit.object.material.color.set("#ff0000")
    //     }
    //   } else {
    //     this.laserLockingTimestamp = Date.now()
    //     this.laserLockingObj = laserHit.object
    //   }
    // } else {
    //   this.laserLockingTimestamp = 0;
    //   this.laserLockingObj = {};
    // }
  }
}
