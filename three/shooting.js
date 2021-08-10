const LOCKING_TIME = 2000;

class Shooting {

  constructor() {
    //this.raycaster = new THREE.Raycaster();
  }

  updateTarget(raycaster, camera, players) {
    raycaster.setFromCamera( {x:0, y:0}, camera );
    raycaster.near = config.targetNear;
    raycaster.far = config.targetFar;

    const intersections = raycaster.intersectObjects(players.boundingBoxes());
    if(intersections.length){
      this.target = intersections[0];
      console.log(this.target.object.parent.name, this.target.distance);
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
