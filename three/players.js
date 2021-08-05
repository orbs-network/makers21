let v3 = new THREE.Vector3(0,0,0);
//////////////////////////////////////////////////////////
class Player{
  //////////////////////////////////////////////////////////
  constructor(obj, nick, isRed, sound){
    this.obj = obj;
    this.moving = false;
    this.isRed = isRed;
    this.gameJoined = false;

    this._initLabel(nick, isRed);
    this.boundingBox = window.factory.firstPerson.createPlayerBoundingBox(this.obj);
    this.obj.add(this.boundingBox)
    this.setColor(isRed);

    // create sounds
    if(sound){ // might be undefined when players added before user started flying
      this.addSound(sound);
    }
    //this.prevRot = new THREE.Vector3(0,0,0);
  }
  //////////////////////////////////////////////////////////
  setColor(isRed){
    this.obj.traverse(child=> {
      if(child instanceof THREE.Mesh) {
        if(isRed){
          child.material.color.setRGB(1,0,0);
        }else{
          child.material.color.setRGB(0,0,1);
        }
      }});
  }
  //////////////////////////////////////////////////////////
  addSound(sound){
    sound.add('fly-by.wav', this.obj, true);
    sound.add('explode.wav', this.obj, false, config.size, 1);
  }
  //////////////////////////////////////////////////////////
  moveForward(){
    if(this.moving){
      this.obj.getWorldDirection(v3);
      const direction = v3.multiplyScalar(-config.speed);
      this.obj.position.add(direction);
    }
  }
  //////////////////////////////////////////////////////////
  onPos(data){
    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
    //this.rotation.set(data.rx, data.ry, data.rz);
    // since camera is oposite- we look backward negative sign
    const factor = -1000;
    this.obj.lookAt(data.dir.x * factor, data.dir.y*factor, data.dir.z*factor);
    this.moveForward();
  }
  //////////////////////////////////////////////////////////
  onStart(data){
    this.moving = data.moving;
    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
  }
  //////////////////////////////////////////////////////////
  onExplode(data, explode){
    // create explosition attached to player
    explode.create(this.obj.position.x, this.obj.position.y, this.obj.position.z);

    // play already installed sound
    let sound = this.obj.getObjectByName('sound_explode.wav');
    if(sound) sound.play();

    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
  }
  //////////////////////////////////////////////////////////
  _initLabel(nick, isRed) {
    const playerLabelDiv = document.createElement( 'div' );
    playerLabelDiv.className = 'player-label';
    playerLabelDiv.textContent = nick || "WHO DIS?";
    playerLabelDiv.style.color = isRed ? '#F33':'33F';
    const playerLabelObj = new THREE.CSS2DObject( playerLabelDiv );
    playerLabelObj.position.set( 0, 0, 0 );
    this.obj.add( playerLabelObj );
  }
}

class Players{
  //////////////////////////////////////////////////////////
  constructor(world){
    this.dict = {};
    this.world= world;
    this.model = world.models['airplane'];

    const material = new THREE.MeshPhongMaterial();
    material.flatShading = false;
    this.matter = material;

		deepStream.subscribe("player", this.onEvent.bind(this));
  }
  //////////////////////////////////////////////////////////
  reset(){
    // hide objects from scene
    for(let p of this.all()){
      p.visible = false;
      // THREE.SceneUtils.detach(p, this.world.scene, this.world.scene);
      // this.world.scene.remove(p);
      // p.clear();
    }
    this.gameJoined = false;
    // remove all wrapping players
    // this.dict = {};

  }
  //////////////////////////////////////////////////////////
  setTeams(red,blue){
    this.red = red;
    this.blue = blue;
  }
  //////////////////////////////////////////////////////////
  onEvent(data){
    // ignore all events fly events if game hasnt started
    if(!this.gameJoined){
      return;
    }

    const p = this.getPlayer(data.nick);
    if(!p){
      console.error(`Player ${data.id} not found`);
      return;
    }
    switch(data.type){
      case "start":
        p.onStart(data);
        break;
      case "pos":
        p.onPos(data);
        break;
      case "explode":
        p.onExplode(data, this.world.explode);
        break;

    }
  }
  //////////////////////////////////////////////////////////
  update(){
    for ( let nick in this.dict){
      this.dict[nick].moveForward();
    }
  }
  //////////////////////////////////////////////////////////
  checkIsRed(nick){
    if(this.red?.includes(nick)) return 1;
    if(this.blue?.includes(nick)) return -1;
    return 0;
  }
  //////////////////////////////////////////////////////////
  setNick(nick){
    this.myNick = nick;
  }
  //////////////////////////////////////////////////////////
  createNew(nick){
    if(nick === this.myNick){
      console.error('must be another tab/player with identical nick', nick);
      return;
    }
    // return null if not in either team
    const isRed = this.checkIsRed(nick);
    if(!isRed){
      console.log(`${nick} wasnt found in either team`);
      console.log('blue team:', this.blue.join());
      console.log('red  team:', this.red.join());
      return null;
    }
    let p = new THREE.Object3D();
    //let p = new THREE.Mesh();
    p.copy(this.model);
    // scale
    const s = SIZE/4;// was2
    p.scale.set(s,s,s);

    p.name = nick;

    this.world.scene.add(p);
    //p.castShadow = true;
    let newPlayer = new Player(p, nick, (isRed===1), this.sound);

    this.dict[nick] = newPlayer;
    console.log('create player',nick);
	  return newPlayer;
  }
  //////////////////////////////////////////////////////////
  //generateBoundingBox (width, height, depth) {
  generateBoundingBox (obj) {
    const geometry = new THREE.Box3().setFromObject( obj );
    //const geometry = new THREE.BoxGeometry(width, height, depth)

    const material = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity:  0.5
    })

    return new THREE.Mesh(geometry, material);
  }
  //////////////////////////////////////////////////////////
  all(){
    let all = [];
    for ( let nick in this.dict){
      all.push(this. dict[nick].obj);
    }
    return all;
  }
  boundingBoxes() {
    let all = [];
    for ( let nick in this.dict){
      all.push(this. dict[nick].boundingBox);
    }
    return all;
  }
  //////////////////////////////////////////////////////////
  initSound(sound){
    this.sound = sound;
    for ( let nick in this.dict){
      this.dict[nick].addSound(sound);
    }
  }
  //////////////////////////////////////////////////////////
  getPlayer(nick){
    const p = this.dict[nick];
    if(p){
      return p;
    }
    return this.createNew(nick);
  }
}
window.Players = Players;
