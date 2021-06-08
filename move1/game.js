window.Game ={
  players:{},
  template: document.getElementById('player'),
  scene: document.getElementById('scene'),
  world: new THREE.Vector3(),
  getPlayer: function(id){
    if (this.players[id]){
      return this.players[id];      
    }
    // create player    
    let player = document.createElement('a-entity');        
    player.id = id;
    player['obj-model']="obj: #airplane";
    player['position']="10 0 0";
    player['scale']="10 10 10";
    player.visible = true;
    
    player.setObject3D('clone', this.template.object3D.clone());  
    //player.setAttribute('visible', true);
    this.players[id] = player;
    this.scene.appendChild(player);
    return player;
  },
  movePlayers: function(speed){
    for(p of player){
      if(p.destPos){
        player.object3D.position = p.destPos;
        p.destPos = null;
      }
      if(p.destRot){
        player.object3D.rotation = p.destRot;
        p.destRot = null;
      }
      // move
      p.object3D.getWorldDirection(this.world);    
      const direction = this.world.multiplyScalar(-speed);
      //direction.z = 0;
  
      //player.object3D.position = 
      p.object3D.position.add(direction);
    }
  }

}



///<a-entity id="player" obj-model="obj: #airplane" position="10 0 0 " scale="10 10 10"></a-entity>