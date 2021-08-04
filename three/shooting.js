const LOCKING_TIME = 2000;

class Shooting {

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  render(scene, camera, players) {
    this.raycaster.setFromCamera( {x:0, y:0}, camera );
    const intersections = this.raycaster.intersectObjects(players.boundingBoxes());

    const laserHit = intersections.find(i => i.distance < 10);
    if (laserHit) {
      if (this.laserLockingObj === laserHit.object) {
        if (Date.now() - this.laserLockingTimestamp > LOCKING_TIME) {
          laserHit.object.material.color.set("#ff0000")
        }
      } else {
        this.laserLockingTimestamp = Date.now()
        this.laserLockingObj = laserHit.object
      }
    } else {
      this.laserLockingTimestamp = 0;
      this.laserLockingObj = {};
    }
  }
}
