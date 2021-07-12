////////////////////////////////////////////////
class Sound {
  ////////////////////////////////////////////////
	constructor() {
    this.positionals = [];
    this.listener = null;
    this.waves = {};
    this.tasks = [];
    // load a sound and set it as the PositionalAudio object's buffer
    this.audioLoader = new THREE.AudioLoader();
  }
  ////////////////////////////////////////////////
  getListener(){
    if (!this.listener){
      this.listener = new THREE.AudioListener();
      game.camera.add( this.listener );
    }
    return this.listener;
  }
  ////////////////////////////////////////////////
  getBuffer(name, cb){
    if(this.waves[name]){
      return cb(this.waves[name]);
    }
    this.audioLoader.load( "./sound/"+name , ( buffer )=> {
      this.waves[name] = buffer;
      return cb(this.waves[name]);
    });
  }
  ////////////////////////////////////////////////
  next(){
    if(!this.tasks.length) return;

    var params = this.tasks.shift();
    this.addAsync.apply(this, params);
  }
  ////////////////////////////////////////////////
  add(name, obj, loop, refDistance, volume){
    this.tasks.push([name, obj, loop, refDistance, volume, this.next.bind(this)]);
    this.next();
  }
  ////////////////////////////////////////////////
  addAsync(name, obj, loop, refDistance, volume, cb){
    // create an AudioListener and add it to the camera
    const listener = this.getListener();

    // create the PositionalAudio object (passing in the listener)
    const sound = new THREE.PositionalAudio( listener );
    this.getBuffer(name, (buffer)=>{
      sound.setBuffer( buffer );
      sound.setLoop(loop? loop : true);
      sound.setRefDistance( /*config.size/30*/ refDistance? refDistance : 1  );
      sound.setVolume( volume? volume : 0.1 );
      //sound.setDistanceModel("orientationX");
      //sound.play();
      // finally add the sound to the mesh
      obj.add( sound );
      this.positionals.push(sound)
      cb();
    });
  }
  ////////////////////////////////////////////////
  play(){
    for(let s of this.positionals){
      s.play();
    }
  }
  ////////////////////////////////////////////////
  pause(){
    for(let s of this.positionals){
      s.pause();
    }
  }
}
