////////////////////////////////////////////////
class Sound {
  ////////////////////////////////////////////////
	constructor(camera) {
    this.positionals = [];
    this.listener = null;
    this.waves = {};
    this.tasks = [];
    // load a sound and set it as the PositionalAudio object's buffer
    this.audioLoader = new THREE.AudioLoader();

    this.listener = new THREE.AudioListener();
    camera.add( this.listener );
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
  add(name, obj, loop, refDistance, volume, duration){
    this.tasks.push([name, obj, loop, refDistance, volume, duration, this.next.bind(this)]);
    this.next();
  }
  ////////////////////////////////////////////////
  addAsync(name, obj, loop, refDistance, volume, duration, cb){
    // create the PositionalAudio object (passing in the listener)
    const sound = new THREE.PositionalAudio( this.listener );
    this.getBuffer(name, (buffer)=>{
      sound.setBuffer( buffer );
      sound.setRefDistance( /*config.size/30*/ refDistance? refDistance : 1  );
      sound.setVolume( volume? volume : 0.1 );
      if(duration){
        if(loop){
          sound.setLoopEnd(duration);
        }else{
          sound.duration = duration;
        }

      }
      sound.name = "sound_"+name;
      //sound.setDistanceModel("orientationX");
      // finally add the sound to the mesh
      obj.add( sound );
      if(loop)
        sound.setLoop(true);
      this.positionals.push(sound);

      // next
      cb();
    });
  }
  ////////////////////////////////////////////////
  play(){
    // play all exclude explosions - by demand
    for(let s of this.positionals){
      if(s.name.indexOf('explode') == -1){
        s.play();
      }
    }
  }
  ////////////////////////////////////////////////
  pause(){
    for(let s of this.positionals){
      s.pause();
    }
  }
}
