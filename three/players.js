let v3 = new THREE.Vector3(0,0,0); 
//////////////////////////////////////////////////////////
class Player{
  //////////////////////////////////////////////////////////  
  constructor(obj){
    this.obj = obj;    
    this.moving = false;   
  }
  //////////////////////////////////////////////////////////
  moveForward(){
    if(this.moving){
      this.obj.getWorldDirection(v3);
      const direction = v3.multiplyScalar(config.speed);        
      this.obj.position.add(direction);
    }
  }
  //////////////////////////////////////////////////////////
  onPos(data){           
    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
    //this.rotation.set(data.rx, data.ry, data.rz);
    this.obj.lookAt(data.dir.x *100, data.dir.y*100, data.dir.z*100);
    //this.moveForward();
  }
  //////////////////////////////////////////////////////////
  onStart(data){           
    this.moving = data.moving;    
    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
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
    const p = this.dummy.clone();
    p.name = name;
    
    
    //p.position.y = 2;
    //p.position.x  = 2;
    
    this.game.scene.add(p);
    const s = 2;
    p.scale.set(s,s,s);
    p.getWorldDirection(v3);
    // p.rotateX( 0.3);
    // p.rotateY( 0.1);
    // p.rotateZ( 0.8);
    p.castShadow = true;
    //p.updateWorldMatrix()
    //p.lookAt(game.redGate.position);
    //p.rotateOnWorldAxis(new THREE.Vector3(1,0,0),  10313.2);
    
    p.visible = true;

    const newPlayer = new Player(p);
    this.dict[name] = newPlayer;
    console.log('create player',name);
    return newPlayer;
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
        object.name = "dummy";        
        object.visible = false;
        this.dummy = object;

        callback(object);
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

