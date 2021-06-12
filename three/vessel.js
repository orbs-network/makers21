let world = new THREE.Vector3();
let yVector = new THREE.Vector3(0.0, 1.0, 0.0);

class Vessel{
  constructor(game, obj) {
    this.obj = obj;
    game.addEventListener('tick', ()=>{
      if(game.start){
        // rotate
        const horiz = game.steering.horiz;
        if(horiz){      
          obj.rotateOnWorldAxis(yVector, horiz);
          //game.camera.rotation.y += this.horiz;
        }

        // move
        obj.getWorldDirection(world);        
        const direction = world.multiplyScalar( config.speed);      
        obj.position.add(direction);
      }
    })
  }  
}