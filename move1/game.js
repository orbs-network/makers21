window.Game ={
  players:{},
  template: document.getElementById('player'),
  scene: document.getElementById('scene'),
  getPlayer(id){
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
  }
}



///<a-entity id="player" obj-model="obj: #airplane" position="10 0 0 " scale="10 10 10"></a-entity>