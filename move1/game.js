window.Game ={
  players:[],
  template: document.getElementById('player'),
  scene: document.getElementById('scene'),
  world: new THREE.Vector3(),
  getPlayer: function(name){
    if (this.players.indexOf(name) > -1){
      return this.scene.object3D.getObjectByName(name);
    }
    let newPlayer = this.template.object3D.clone(); 
    newPlayer.name = name;
    newPlayer.visible = true;   
    this.scene.object3D.add(newPlayer);
    this.players.push(name);    
    return this.scene.object3D.getObjectByName(name);
  },
  movePlayers: function(speed){
    for(let name of this.players){
      let p = this.scene.object3D.getObjectByName(name);
      if(p.destPos){
        //p.position = p.destPos;
        p.position.x = p.destPos.x;
        p.position.y = p.destPos.y;
        p.position.z = p.destPos.z;
        //p.position.set(p.destPos);
        p.destPos = null;
      }
      if(p.destRot){
        p.rotation.x = p.destRot.x;
        p.rotation.y = p.destRot.y;
        p.rotation.z = p.destRot.z;
        //p.rotation = p.destRot;
        //p.rotateOnWorldAzis(p.destRot, 0.1);
        //p.setRotationFromEuler(new THREE.Euler( p.destRot.x, p.destRot.y, p.destRot.z, 'XYZ' )); 
        p.destRot = null;
      }
      // move
      p.getWorldDirection(this.world);    
      const direction = this.world.multiplyScalar(-speed);
        
      p.position.add(direction);
    }
  }

}



///<a-entity id="player" obj-model="obj: #airplane" position="10 0 0 " scale="10 10 10"></a-entity>