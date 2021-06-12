let world = new THREE.Vector3();

class Vessel{
  constructor(game, obj) {
    this.obj = obj;
    game.addEventListener('tick', ()=>{
      if(game.start){
        // // rotate
        // if(this.horiz){      
        //   //     //game.camera.rotateOnWorldAxis(this.yVector, this.horiz);
        //   //     game.camera.rotation.y += this.horiz;
        //   //   }

        // move
        obj.getWorldDirection(world);        
        const direction = world.multiplyScalar( config.speed);      
        obj.position.add(direction);
      }
    })
  }  
}