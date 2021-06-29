const keyDown = function(e){
  switch ( e.code ) {
    case "Space":{
      game.startStop();
    }
    break;
    case "ArrowRight":          
      game.steering.addHoriz(-config.rotUnit);    
    break
    case "ArrowLeft":        
      game.steering.addHoriz( config.rotUnit);
      break;
    case "ArrowUp":          
      game.steering.addVert(config.rotUnit);
      break;
    case "ArrowDown":          
      game.steering.addVert(-config.rotUnit);
      break;        
  }
}

const keyUp = function(e){
  switch ( e.code ) {    
    case "ArrowRight":                
    case "ArrowLeft":        
      game.steering.releaseHoriz();
      break;
    case "ArrowUp":                
    case "ArrowDown":          
      game.steering.releaseVert();
      break;        
  }
}

document.body.addEventListener("keydown", keyDown)
document.body.addEventListener("keyup", keyUp)