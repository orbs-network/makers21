var ctx = null;
cam = null;
const speed = 0.01;
const hFactor = 0.1 ;
const vFactor = 0.05 ;
const alttd = 0.1;
const vLimit = 20;
const levelHrznRate = 0.95
let stop = true;

window.GAZE_ORIENTATION = {x: 0, y: 0};


// define a custom component
//AFRAME.registerComponent("foo", {
AFRAME.registerComponent('move-control', {  
  world: new THREE.Vector3(),
  init: function() {
    console.log('move-control init------');
    
    // grab the camera
    this.cam = this.el.object3D;

    //var tid;
    window.addEventListener("keydown", (e) => {
      switch (e.code){
        // case "keyA":
        //cam.rotation.x = 0;
        //   break;
        case "Space":
          stop = !stop;
          if(!stop){
            window.GAZE_ORIENTATION.zeroX = window.GAZE_ORIENTATION.x;
            window.GAZE_ORIENTATION.zeroY = window.GAZE_ORIENTATION.y;
          }
          break;
        case "ArrowRight":          
          this.cam.rotateOnWorldAxis(new THREE.Vector3(0.0, 1.0, 0.0), -0.1);
          
          break
        case "ArrowLeft":        
          this.cam.rotateOnWorldAxis(new THREE.Vector3(0.0, 1.0, 0.0), 0.1);          
          break;
        case "ArrowUp":          
          this.cam.rotateX(0.1);          
          break;
        case "ArrowDown":          
          this.cam.rotateX(-0.1);          
          break;        
      }      
    });
    // server update position          
    let _cam = this.cam;
    let wPos = new THREE.Vector3();
    let wRot = new THREE.Vector3();
    setInterval(()=>{   
      _cam.getWorldPosition(wPos);
      //_cam.getWorldDirection(wRot);
      //console.log(wPos, wRot);
      window.networkLayer.sendPos(wPos, _cam.rotation); // is euler
    }, 500);
    
  },
  levelHrzn:function() {
    this.cam.rotation.z;
    if (z === 0){
      return;
    }
    z *= levelHrznRate;
    if (Math.abs(z) < 0.01){
      z = 0;
      console.log('horizon is leveled')
    }
    this.cam.rotation.z = z;
      
  },
  move: function(){    
    // create a direction vector
    // var direction = new THREE.Vector3();
    // // get the cameras world direction
    // ctx.el.sceneEl.camera.getWorldDirection(direction);
    // multiply the direction by a "speed" factor  
    this.cam.getWorldDirection(this.world);        
    const direction = this.world.multiplyScalar(-speed);
    
    this.cam.position.add(direction);
    
    // get the current position
    // cam.getAttribute("position")
    // // add the direction vector
    // //pos.add(direction)
    // // set the new position
    // cam.setAttribute("position", pos); 
    
    // // !!! NOTE - it would be more efficient to do the
    // // position change on the players THREE.Object:
    // cam.position.add(direction)`
    // but it would break "getAttribute("position")
  
  },
  tick: function () {
    //this.levelHrzn();
    if(stop)
      return;
    
    const hTurn = window.GAZE_ORIENTATION.x - window.GAZE_ORIENTATION.zeroX;
    const vTurn = window.GAZE_ORIENTATION.zeroY - window.GAZE_ORIENTATION.y;

    // sideways
    //cam.rotateY(hTurn * hFactor); - causing horizon lost
    this.cam.rotateOnWorldAxis(new THREE.Vector3(0.0, 1.0, 0.0), hTurn * hFactor);       
    // vertical    
    this.cam.rotateX(vTurn  * vFactor);

    this.move();

    window.Game.movePlayers(speed);    
  }
});