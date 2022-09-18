class Steering{
  constructor() {
    this.horiz = 0;
    this.vert = 0;
    // this.releaseH = true;
    // this.releaseV = true;
  }
  addHoriz(unit){
    this.clearReleaseInterval();
    //this.releaseH = false;
    this.horiz += unit;
    // limit
    if(Math.abs(this.horiz) > config.horizLimit){
      this.horiz = config.horizLimit * (this.horiz/Math.abs(this.horiz)); // 1 or -1
    }
  }
  addVert(unit){
    this.clearReleaseInterval();
    //this.releaseV = false;
    this.vert += unit;
    // limit
    if(Math.abs(this.vert) > config.vertLimit){
      this.vert = config.vertLimit * (this.vert/Math.abs(this.vert)); // 1 or -1
    }
  }
  clearReleaseInterval(){
    if(this.tidRelease){
      clearInterval(this.tidRelease);
      this.tidRelease = null;
    }
  }
  releaseHoriz(){
    //this.releaseH = true;
    // interval already going
    if(this.tidRelease){
      return;
    }
    this.tidRelease = setInterval(()=>{
      if(this.horiz){
        this.horiz *= config.steerReleaseFactor;
        if(Math.abs(this.horiz) <= 0.001){
          this.horiz =0;
          this.clearReleaseInterval();
        }
      }
    },50);
  }
  releaseVert(){
  }
}
