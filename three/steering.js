class Steering{  
  constructor() {
    this.horiz = 0;
    this.vert = 0;
    this.releaseH = true;
    this.releaseV = true;
    this.yVector = new THREE.Vector3(0.0, 1.0, 0.0)
  }
  addHoriz(unit){
    this.releaseH = false;
    this.horiz += unit;
    this.updateRotation();
  }
  addVert(unit){
    this.releaseV = false;
    this.vert += unit;    
  }
  releaseHoriz(){
    this.releaseH = true;
  }
  releaseVert(){
    this.releaseV = true;
  }
  // updateRotation(){
  //   if(this.horiz){      
  //     //game.camera.rotateOnWorldAxis(this.yVector, this.horiz);
  //     game.camera.rotation.y += this.horiz;
  //   }
  // }
}