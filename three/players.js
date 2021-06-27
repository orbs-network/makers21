//////////////////////////////////////////////////////////
class Player{
  //////////////////////////////////////////////////////////  
  constructor(obj){
    this.obj = obj;
    this.v3 = new THREE.Vector3(0,0,0); 
    this.start = false;   
  }
  //////////////////////////////////////////////////////////
  moveForward(){
    this.obj.getWorldDirection(this.v3);
    const direction = this.v3.multiplyScalar(config.speed);        
    this.obj.position.add(direction);
  }
  //////////////////////////////////////////////////////////
  onPos(data){           
    this.obj.position.set(data.x, data.y, data.z);
    //this.rotation.set(data.rx, data.ry, data.rz);
    this.obj.lookAt(data.rx *100, data.ry*100, data.rz*100);
    this.moveForward();
  }
  //////////////////////////////////////////////////////////
  onStart(data){           
    this.start = false;
    this.destPos = data.pos;
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
    material.color.setHSL(0, 1, .5);  // red
    //material.color.setRGB(100, 200, 50); 
    material.flatShading = true;
    this.matter = material;
    this.createDummy();
    window.deepStream.subscribe("player", this.onEvent.bind(this));
            
    //super();
    
    // this.start = false;
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
    const p = this.dummy.clone();
    p.name = name;
    this.game.scene.add(p);
    p.visible = true;

    const newPlayer = new Player(p);
    this.dict[name] = newPlayer;
    return newPlayer;
  }
  //////////////////////////////////////////////////////////
  createDummy(){
    // let newPlayer = this.template.object3D.clone(); 
    // newPlayer.name = name;
    // newPlayer.visible = true;   
    // this.scene.object3D.add(newPlayer);
    // this.players.push(name);    
    // return this.scene.object3D.getObjectByName(name);
    // load a resource    
    //let scene = this.game.scene;
    let matter = this.matter;
    this.loader.load(
      // resource URL
      'model/airplane.obj',
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
        object.name = "dummy";
        //scene.add( object );        
        object.visible = false;        
        object.scale.set(3,3,3);
        object.position.y = 2;
        object.position.x  = 2;
        this.dummy = object;
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
  getPlayer(name){
    const p = this.dict[name];
    if(p){
      return p;
    }
    return this.createNew(name);    
  }  
}
window.Players = Players;

