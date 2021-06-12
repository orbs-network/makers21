class Sound {
	constructor() {
    this.positionals = [];
    this.listener = null;
  }
  getListener(){
    if (!this.listener){
      this.listener = new THREE.AudioListener();
      game.camera.add( this.listener );  
    }
    return this.listener;
  }
  
  add(name, obj){
    // create an AudioListener and add it to the camera
    const listener = this.getListener();
      
    // create the PositionalAudio object (passing in the listener)
    const sound = new THREE.PositionalAudio( listener );
  
    // load a sound and set it as the PositionalAudio object's buffer
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load( "./sound/"+name , function( buffer ) {
      sound.setBuffer( buffer );
      sound.setLoop(true);
      sound.setRefDistance( /*config.size/30*/1  );
      //sound.setDistanceModel("orientationX");
      sound.play();
    });
  
    // finally add the sound to the mesh
    obj.add( sound );
    this.positionals.push(sound)
    return sound;
  }
  play(){
    for(let s of this.positionals){
      s.play();
    }
  }
  pause(){
    for(let s of this.positionals){
      s.pause();
    }
  }
}
