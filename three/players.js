let v3 = new THREE.Vector3(0,0,0);
//////////////////////////////////////////////////////////
class Player{
  //////////////////////////////////////////////////////////
  constructor(obj, name, explode, sound){
    this.obj = obj;
    this.moving = false;
    this._initLabel(name);
    this.explode = explode;

    // create sounds
    sound.add('fly-by.wav', obj);
    sound.add('explode.wav', this.obj, false, config.size, 1);

    //this.prevRot = new THREE.Vector3(0,0,0);
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
  onExplode(data){
    // create explosition attached to player
    this.explode.create(this.obj.position.x, this.obj.position.y, this.obj.position.z);

    // play already installed sound
    let sound = this.obj.getObjectByName('sound_explode.wav');
    if(sound) sound.play();

    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
  }
  //////////////////////////////////////////////////////////
  _initLabel(name) {
    const playerLabelDiv = document.createElement( 'div' );
    playerLabelDiv.className = 'player-label';
    var prettyName = name?.split('_')[0];
    playerLabelDiv.textContent = prettyName || "who dis?";
    playerLabelDiv.style.marginTop = '2em';
    playerLabelDiv.style.color = "#77777799";
    playerLabelDiv.style.fontFamily = "monospace";
    const playerLabelObj = new THREE.CSS2DObject( playerLabelDiv );
    playerLabelObj.position.set( 0, 0, 0 );
    this.obj.add( playerLabelObj );
  }
}

class Players{
  //////////////////////////////////////////////////////////
  constructor(game){
    this.dict = {};
    this.game = game;
    this.loader = new THREE.OBJLoader();
    //this.redMatter = new THREE.MeshBasicMaterial({color: 0xFF00FF});         // red
    const material = new THREE.MeshPhongMaterial();
    //material.color.setHSL(0, 1, .5);  // red
    material.color.setRGB(.3, .8, .5);
    material.flatShading = false;
    this.matter = material;
    this.createDummy(()=> {
		  window.deepStream.subscribe("player", this.onEvent.bind(this));
    });


    //super();

    // this.moving = false;
    // this.first = true;
    // this.sound = new Sound();
    // //this.steering = new Steering();
  }
  //////////////////////////////////////////////////////////
  onEvent(data){
    const p = this.getPlayer(data.id);
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
        p.onExplode(data, game.explode);
        break;

    }

  }
  //////////////////////////////////////////////////////////
  update(){
    for ( let name in this.dict){
      this.dict[name].moveForward();
    }
  }
  //////////////////////////////////////////////////////////
  createNew(name){
    if(!this.dummy){
      return null;
    }
    //const p = this.dummy.clone(); //- doesnt copy geometry
    //const p = this.dummy.copy();
    let p = new THREE.Object3D();
    //let p = new THREE.Mesh();
    p.copy(this.dummy);
    p.name = name;

    this.game.scene.add(p);
    //p.castShadow = true;
    let newPlayer = new Player(p, name, game.explode, this.sound);

    this.dict[name] = newPlayer;
    console.log('create player',name);
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
        opacity:  0.1
    })

    return new THREE.Mesh(geometry, material);
  }
  //////////////////////////////////////////////////////////
  createDummy(callback){
    let matter = this.matter;
    this.loader.load(
      // resource URL
      //'model/old/11804_Airplane_v2_l2.obj',
      'model/paper/airplane.obj',
      // called when resource is loaded
      function ( object ) {
        object.traverse(function(child) {
          if(child instanceof THREE.Mesh) {
            //console.log(child.material);
            //var m = child.material;
            //console.log('1', JSON.stringify(m));
            // child.material = new THREE.MeshPhongMaterial({
              //   color: 0xFF0000,    // red (can also use a CSS color string here)
              //   flatShading: true,
              // });
              child.material = matter;
              //console.log(child);
              //child.material.map = texture;
              //child.material.normalMap = normal;
            }
          });

      const s = 2;// was2
      object.scale.set(s,s,s);



      this.dummy = object;
      this.dummy.name = "dummy";
      callback();

    }.bind(this),
      // called when loading is in progresses
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      // called when loading has errors
      function ( error ) {
        console.log( 'An error happened', error );
      }
    );
  }
  //////////////////////////////////////////////////////////
  all(){
    let all = [];
    for ( let name in this.dict){
      all.push(this. dict[name].obj);
    }
    return all;
  }
  //////////////////////////////////////////////////////////
  initSound(sound){
    this.sound= sound;
    // for ( let p of this.all()){
    //   sound.add('fly-by.wav', p);
    //   this.sound.add('explode.wav', this.camera, loop, config.size, vol);
    // }
  }
  //////////////////////////////////////////////////////////
  getPlayer(name){
    const p = this.dict[name];
    if(p){
      return p;
    }
    return this.createNew(name);
  }
}
window.Players = Players;
