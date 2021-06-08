var ctx = null;
var player = null;
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
  init: function() {
    console.log('move-control init------');
    // grab the camera
    player = this.el;//document.querySelector("#cam")
    camCam = this.el.components.camera.camera;
    ctx = this;
    player.object3D.up.set( 1, 0,0 );
    world = new THREE.Vector3();
    cursor = document.getElementById("cursor");
    
    //var tid;
    window.addEventListener("keydown", (e) => {
      switch (e.code){
        // case "keyA":
        //   player.object3D.rotation.x = 0;
        //   break;
        case "Space":
          stop = !stop;
          if(!stop){
            window.GAZE_ORIENTATION.zeroX = window.GAZE_ORIENTATION.x;
            window.GAZE_ORIENTATION.zeroY = window.GAZE_ORIENTATION.y;
          }
          break;
        case "ArrowRight":
          //player.object3D.rotation.x = Math.PI / 180 * 90;
          // player.object3D.rotation.x = 0;
          // player.object3D.rotation.z = 0;
          //var axis = new THREE.Vector3(0,1,0);//tilted a bit on x and y - feel free to plug your different axis here
          //in your update/draw function
          //rad = 0.1;
          //player.object3D.rotateOnAxis(axis,-rad);
          //player.object3D.rotation.y -= turn ;//= THREE.Math.degToRad(45);          
          //player.object3D.rotateOnAxis()          
          //player.object3D.rotation.y += turn;
          
          //player.object3D.rotateY(-0.1);
          //player.object3D.getWorldDirection(world);
          //let pos = cursor.object3D.localToWorld(world);
          //player.object3D.lookAt(pos);
          player.object3D.rotateOnWorldAxis(new THREE.Vector3(0.0, 1.0, 0.0), -0.1);
          //player.object3D.setRotationFromMatrix()

          break
        case "ArrowLeft":
          //var axis = new THREE.Vector3(0,1,0);//tilted a bit on x and y - feel free to plug your different axis here
          //in your update/draw function
          //rad = 0.1;
          //player.object3D.rotateOnAxis(axis,rad);
          //player.object3D.rotateY(0.1);
          player.object3D.rotateOnWorldAxis(new THREE.Vector3(0.0, 1.0, 0.0), 0.1);
          //player.object3D.rotateOnWorldAxis(player.object3D.getWorldDirection(), 0);
          //player.object3D.rotation.y += turn; //= THREE.Math.degToRad(45);          
          break;
        case "ArrowUp":
          //var axis = player.object3D.getWorldDirection();
          //var axis = new THREE.Vector3(1,0,0);//tilted a bit on x and y - feel free to plug your different axis here
          //var axis = player.object3D.rotation;
          //in your update/draw function
          //rad = 0.1;
          //player.object3D.rotation.x += 0.1;
          //player.object3D.up
          //player.object3D.setRotationFromAxisAngle(axis,0);
          //player.object3D.setRotationFromAxisAngle(axis,0);
          //player.object3D.rotateOnWorldAxis(axis,rad);
          
          player.object3D.rotateX(0.1);
          //player.object3D.rotateOnWorldAxis(new THREE.Vector3(1.0, 0.0, 0.0), 0.1);
          

          // if(player.object3D.rotation.x > 0.3)
          //   player.object3D.rotation.x =0.3;

          //player.object3D.position.y += alttd//Math.PI * turn;
          //player.object3D.rotation.x -= turn; //= THREE.Math.degToRad(45);
          //if (player.object3D.rotation.x > Math.PI * 0.25)
          //clearTimeout(tid);
          
          // tid = setTimeout(() => {
          //   player.object3D.rotation.x = 0; // restor horiz flight
          // }, 200);
          break;
        case "ArrowDown":
          
          player.object3D.rotateX(-0.1);
          //player.object3D.rotateOnWorldAxis(new THREE.Vector3(1.0, 0.0, 0.0), -0.1);
          //player.object3D.rotation.x -= 0.1;
          //var axis = new THREE.Vector3(0,0,1);//tilted a bit on x and y - feel free to plug your different axis here
          //in your update/draw function
          //rad = 0.1;
          //player.object3D.rotateOnWorldAxis(axis,-rad);
          
          //player.object3D.position.y -= alttd//Math.PI * turn;
          //clearTimeout(tid);
          //player.object3D.rotation.x += turn; //= THREE.Math.degToRad(45);
          //if (player.object3D.rotation.x < Math.PI * -0.25)
          //player.object3D.rotation.x += Math.PI * -turn;
          // tid = setTimeout(() => {
          //   player.object3D.rotation.x = 0; // restor horiz flight
          // }, 200);
          break;
      
        //player.object3D.rotation.divideScalar(2);
      }
      //var scene = this.el.sceneEl.object3D;
      //console.log(scene.rotation);
      // console.log(player.object3D.rotation);
      // console.log(player.object3D.getWorldDirection());
      // let direction = new THREE.Vector3();
      // ctx.el.sceneEl.camera.getWorldDirection(direction);  
      // console.log(direction);
      

    });

    // setInterval(()=>{
    //   move(player);
    // },10);
    
  },
  levelHrzn:function() {
    let z = player.object3D.rotation.z;
    if (z === 0){
      return;
    }
    z *= levelHrznRate;
    if (Math.abs(z) < 0.01){
      z = 0;
      console.log('horizon is leveled')
    }
    player.object3D.rotation.z = z;
      
  },
  move: function(){    
    // create a direction vector
    // var direction = new THREE.Vector3();
    // // get the cameras world direction
    // ctx.el.sceneEl.camera.getWorldDirection(direction);
    // multiply the direction by a "speed" factor  
    player.object3D.getWorldDirection(world);    
    

    const direction = world.multiplyScalar(-speed);
    //direction.z = 0;

    //player.object3D.position = 
    player.object3D.position.add(direction);
    window.networkLayer.sendPos(player.object3D.position, player.object3D.rotation);
    // get the current position
    //var pos = player.getAttribute("position")
    // add the direction vector
    //pos.add(direction)
    // set the new position
    //player.setAttribute("position", pos); 
    
    // !!! NOTE - it would be more efficient to do the
    // position change on the players THREE.Object:
    // `player.object3D.position.add(direction)`
    // but it would break "getAttribute("position")
  
  },
  tick: function () {
    //this.levelHrzn();
    if(stop)
      return;

    

    const hTurn = window.GAZE_ORIENTATION.x - window.GAZE_ORIENTATION.zeroX;
    const vTurn = window.GAZE_ORIENTATION.zeroY - window.GAZE_ORIENTATION.y;

    // sideways
    // player.object3D.rotateY(hTurn * hFactor); - causing horizon lost
    player.object3D.rotateOnWorldAxis(new THREE.Vector3(0.0, 1.0, 0.0), hTurn * hFactor);       
    // vertical    
    player.object3D.rotateX(vTurn  * vFactor); 

    //if( player.object3D.rotation.x >= -player.object3D.x && player.object3D.rotation.x <= -player.object3D.x

    //player.object3D.rotateOnWorldAxis(player.object3D.getWorldDirection(), 0);



    // downup - altitude
    //player.object3D.rotation.x += sideY;
    //player.object3D.position.y += sideY ;//* alttd; // alt

    // down up    
    //player.object3D.rotation.z -= sideY; 
    //player.object3D.rotation.x += sideY ; 

    // player.object3D.rotation.x += sideY * 0.25;
    // if (player.object3D.rotation.x > Math.PI * 0.25) player.object3D.rotation.x  = Math.PI * 0.25;
    // if (player.object3D.rotation.x < Math.PI * -0.25) player.object3D.rotation.x = Math.PI * -0.25;

    this.move();    
    //player.object3D.position.add(this.direction.multiplyScalar(speed));
    //player.parent.position.add(player.getWorldDirection().multiplyScalar(speed));
    
    //camCam.parent.position.add(camCam.getWorldDirection().multiplyScalar(speed));
				

    // change rotation with this.el.object3D.rotation
    // change position with this.el.object3D.position
    
    // left right
    // this.rotation.y += window.GAZE_ORIENTATION.x * 0.25;   
    
    // // up down
    // this.rotation.x -= window.GAZE_ORIENTATION.y * 0.25;
    // if (this.rotation.x > Math.PI * 0.25) this.rotation.x  = Math.PI * 0.25;
    // if (this.rotation.x < Math.PI * -0.05) this.rotation.x = Math.PI * -0.05;
    
    // this.el.object3D.rotation.x += this.rotation.x;
    // this.el.object3D.rotation.y += this.rotation.y;
  }
});