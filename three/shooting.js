const LOCKING_TIME = 2000;
//////////////////////////////////////////////
class Shooting {
  //////////////////////////////////////////////
  constructor() {
    //this.raycaster = new THREE.Raycaster();
    this.isRed = "uninitialized!!!";
  }
  //////////////////////////////////////////////
  createHUD(){
    const hud = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      hud.add(new THREE.Mesh(new THREE.RingGeometry(0.045, 0.055, 128, 1, hPi * i + 0.2, hPi - 0.4), new THREE.LineBasicMaterial({color: `#ffffff`, transparent:true, opacity:0.1})))
    }
    hud.position.set( 0, 0, -1 );
    this.hud = hud;
    return hud;
  }
  //////////////////////////////////////////////
  setHudColor(color) {
    for( let child of this.hud.children){
      child.material.color.set(color);
    }
  }
  //////////////////////////////////////////////
  setHudOpacity(opacity) {
    for( let child of this.hud.children){
      child.material.opacity = opacity;
    }
  }
  //////////////////////////////////////////////
  setHudState() {
    this.setHudOpacity(this.target? 1: 0.1);
    // neutral
    if(!this.target){
      this.setHudColor("0xFFFFFF");
    }
    else{
      const friend = this.isRed == this.target.isRed;
      this.setHudColor(friend? "#00FF00": "#FFFF00");
    }
  }
  //////////////////////////////////////////////
  onNewTarget(target, players) {
    if(this.target){
      this.target.material.opacity = 0;
    }
    this.target = target;

    this.setHudState()
    if(!target){
      return;
    }

    this.targetPlayer = players.getPlayer(this.target.parent.name);

    // target bounding sphere visible
    this.target.material.opacity = 0.3;
  }
  //////////////////////////////////////////////
  updateTarget(raycaster, players) {
    raycaster.near = config.targetNear;
    raycaster.far = config.targetFar;

    const spheres = players.boundSpheres();
    const intersections = raycaster.intersectObjects(spheres);
    let target;
    if(intersections.length){
      target = intersections[0].object;
      //console.log(this.target.name, intersections[0].distance);//, dis);
    }
    // target changed
    if(target != this.target){
      this.onNewTarget(target, players);
    }

    // highlight target boxe
    for( let s of spheres ) {
      s.material.opacity = (this.target && s.name === this.target.name)? 0.3:0;
    }

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
