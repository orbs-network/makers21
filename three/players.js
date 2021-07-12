let v3 = new THREE.Vector3(0,0,0);
//////////////////////////////////////////////////////////
class Player{
  //////////////////////////////////////////////////////////
  constructor(obj, name){
    this.obj = obj;
    this.moving = false;
    this._initLabel(name);
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

  _initLabel(name) {
    const playerLabelDiv = document.createElement( 'div' );
    playerLabelDiv.className = 'player-label';
    playerLabelDiv.textContent = name || "who dis?";
    playerLabelDiv.style.marginTop = '2em';
    playerLabelDiv.style.color = 'white';
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
      case "pos":
        p.onPos(data);
        break;
      case "start":
        p.onStart(data);
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

    //p.position.y = 2;
    //p.position.x  = 2;

    this.game.scene.add(p);

    //p.rotation.x = Math.PI / 3;
    // ALL THAT WONT ROTATE
    // p.position.z -= 20;
    // var axis = new THREE.Vector3(0.5,0.5,0);//tilted a bit on x and y - feel free to plug your different axis here
    // //in your update/draw function
    // p.rotateOnAxis(axis,1000);
    // p.updateMatrix();
    // p.updateMatrixWorld(true);
    // p.updateWorldMatrix(true, true);
    //p.getWorldDirection(v3);
    // p.rotateX( 0.3);
    // p.rotateY( 0.1);
    // p.rotateZ( 0.8);
    p.castShadow = true;
    //p.updateWorldMatrix()
    //p.lookAt(game.redGate.position);
    //p.rotateOnWorldAxis(new THREE.Vector3(1,0,0),  10313.2);

    //p.visible = true; add to scene creates it
    if(this.sound)
      this.sound.add('airplane-fly-by.wav', p);

    const newPlayer = new Player(p, name);
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
      //object.position.set(6, 1, 0);
      //object.scale.set( new THREE.Vector3( 3, 3, 3 ));
      //object.name = "airplane";
      //
      const s = 2;// was2
      object.scale.set(s,s,s);


      //const bbox = this.generateBoundingBox(0.1,0.1,0.1);
      //const bbox = this.generateBoundingBox(object);
      //bbox.add(object);
      // turn 180 horiz
      //object.rotateY(3.14159);
      //this.dummy = bbox;

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
    for ( let p of this.all()){
      sound.add('airplane-fly-by.wav', p);
    }
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
