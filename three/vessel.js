let world = new THREE.Vector3();
const yVector = new THREE.Vector3(0.0, 1.0, 0.0);
const xVector = new THREE.Vector3(1.0, 0.0, 0.0);

class Vessel{
  constructor(game, obj) {
    this.obj = obj;
    game.addEventListener('tick', ()=>{
      if(game.start){
        // rotate
        const horiz = game.steering.horiz;
        if(horiz){ // preceeds vert     
          obj.rotateOnWorldAxis(yVector, horiz);
          //game.camera.rotation.y += horiz;
        } 
        if (game.steering.vert){
          obj.rotateOnWorldAxis(xVector, game.steering.vert);
          //obj.rotation.x += game.steering.vert;

        }

        // move
        obj.getWorldDirection(world);        
        const direction = world.multiplyScalar( config.speed);      
        obj.position.add(direction);
      }
    })
  }  
}