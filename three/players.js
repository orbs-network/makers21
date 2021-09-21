let v3 = new THREE.Vector3(0,0,0);
const lookDistance = -1000;

//////////////////////////////////////////////////////////
class Player{
  //////////////////////////////////////////////////////////
  constructor(obj, nick, isRed, sound, useShooting){
    this.obj = obj;
    this.moving = false;
    this.isRed = isRed;
    this.gameJoined = false;
    this.nick = nick;
    this.go2Target = false;

    this._initLabel(nick, isRed);

    // create sounds
    if(sound){ // might be undefined when players added before user started flying
      this.addSound(sound);
    }
    // DO BEFORE SHOOTING SO IT DOESNT REPLACE ADDED SPHERE MATTERIAL
    this.setMaterialColor(isRed? materials.redPhong : materials.bluePhong);

    // useShooting
    this.useShooting = useShooting;
    if(useShooting){
      // bounding sphere
      const geometry = new THREE.SphereGeometry( config.playerSphereSize, 16, 8 );
      // create new matterial per sphere so opacity can be changed individually
      this.boundSphere = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: isRed? 0xFF0000:0x0000FF } ) );
      this.boundSphere.layers.enable(1); // MUST
      this.boundSphere.material.transparent = true;
      this.boundSphere.name = nick + '_bound_sphere';
      this.boundSphere.material.opacity = 0; // invisible
      this.obj.add(this.boundSphere);
      // lasser beam
      var laserBeam	= new THREEx.LaserBeam();
      this.obj.add(laserBeam.object3d);
      laserBeam.object3d.visible = false;
      laserBeam.object3d.rotateY(THREE.MathUtils.degToRad(90));
      laserBeam.object3d.position.z = -.05; // infront of airplane
      this.laserBeam = laserBeam;
    }
  }
  //////////////////////////////////////////////////////////
  setMaterialColor(matterial){
    this.obj.traverse(child=> {
      if(child instanceof THREE.Mesh) {
        child.material = matterial;
      }});
  }
  //////////////////////////////////////////////////////////
  addSound(sound){
    sound.add('fly-by.wav', this.obj, true);
    sound.add('explode.wav', this.obj, false, config.size, 1);
    sound.add('laser.wav', this.obj, false, config.size, 1);
  }
  //////////////////////////////////////////////////////////
  update(delta, now){
    if(this.moving){
      // NEW
      if(this.go2Target){
        // Position
        this.obj.position.x += this.xPerMS * delta;
        this.obj.position.y += this.yPerMS * delta;
        this.obj.position.z += this.zPerMS * delta;
        // Rotation
        // this.obj.rotation.x += this.xRotPerMS * delta;
        // this.obj.rotation.y += this.yRotPerMS * delta;
        // this.obj.rotation.z += this.zRotPerMS * delta;
      }else{
        // OLD
        this.obj.getWorldDirection(v3);
        //const direction = v3.multiplyScalar(-config.speed);
        let distance = config.distancePerMS * delta ;
        const direction = v3.multiplyScalar(-distance);
        this.obj.position.add(direction);
        //console.log('passed target!!!');
      }
    }
  }
  //////////////////////////////////////////////////////////
  onPos(data){
    // direction
    // this.lookTarget = {
    //   x: data.dir.x * lookDistance,
    //   y: data.dir.y * lookDistance,
    //   z: data.dir.z * lookDistance
    // }
    // OLD
    this.obj.lookAt(data.dir.x * lookDistance, data.dir.y*lookDistance, data.dir.z*lookDistance);

    // position if not moving
    this.moving = data.moving;
    if(!this.moving){
      this.obj.position.x = data.targetPos.x;
      this.obj.position.y = data.targetPos.y;
      this.obj.position.z = data.targetPos.z;
      return;
    }

    // First time pos
    // if(isNaN(this.obj.position.x)){
    //   this.obj.position.x = data.targetPos.x;
    //   this.obj.position.y = data.targetPos.y;
    //   this.obj.position.z = data.targetPos.z;
    //   this.go2Target = false;
    //   return;
    // }

    // OLD
    // this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
    // //this.rotation.set(data.rx, data.ry, data.rz);
    // // since camera is oposite- we look backward negative sign

    // this.moveForward();
    // NEW
    // this.targetDir = data.dir;
    // this.targetPos = data.targetPos;
    //this.targetTS = data.targetTS;
    // NEW 2


    const timeToTarget = data.targetTS - Date.now();
    if(timeToTarget > 0){
      // Position
      this.go2Target = true;
      this.xPerMS = (data.targetPos.x - this.obj.position.x) / timeToTarget;
      this.yPerMS = (data.targetPos.y - this.obj.position.y) / timeToTarget;
      this.zPerMS = (data.targetPos.z - this.obj.position.z) / timeToTarget;
      // Rotation
      //this.obj.applyQuaternion(data.quaternion);
      //this.obj.setRotationFromQuaternion(data.quaternion);
      // this.obj.getWorldDirection(v3);
      // this.xRotPerMS = (data.dir.x - v3.x) / timeToTarget;
      // this.yRotPerMS = (data.dir.y - v3.y) / timeToTarget;
      // this.zRotPerMS = (data.dir.z - v3.z) / timeToTarget;
    }else{
      this.go2Target = false;
    }
  }
  //////////////////////////////////////////////////////////
  onStart(data){
    this.moving = data.moving;
    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
  }
  //////////////////////////////////////////////////////////
  onExplode(data, explode){
    // hide exploding airplaine
    this.obj.visible = false;
    this.moving = false;

    // create explosition attached to player
    explode.create(this.obj.position.x, this.obj.position.y, this.obj.position.z);

    // play already installed sound
    let sound = this.obj.getObjectByName('sound_explode.wav');
    if(sound) sound.play();

    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
  }
  //////////////////////////////////////////////////////////
  onFire(data){
    // play already installed sound
    let sound = this.obj.getObjectByName('sound_laser.wav');

    if(sound) sound.play();
    this.laserBeam.object3d.visible = true;
    // auto hide
    if(this.tidHideFire){
      clearTimeout(this.tidHideFire);
    }
    this.tidHideFire = setTimeout(() =>{
      this.laserBeam.object3d.visible = false;
      this.tidHideFire = null;
    },200);


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

    this.redMaterial =

    this.blueMaterial = new THREE.MeshPhongMaterial({
      color: 0x0000FF,    // red (can also use a CSS color string here)
      flatShading: true,
      side: THREE.DoubleSide
    });
    //const material = new THREE.MeshPhongMaterial();
    //const material = THREE.MeshToonMaterial();
    //const material = THREE.MeshBasicMaterial();
    //material.flatShading = false;
    //material.flatShading = true;
    //this.matter = material;
    this.useShooting = false;

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
        p.obj.visible = true;
        break;
      case "pos":
        p.obj.visible = true;
        p.onPos(data);
        break;
      case "explode":
        p.onExplode(data, this.world.explode);
        break;
      case "fire":
        p.onFire(data);
        // explode myself if im the target
        game.checkFireTarget(data);
        break;

    }
  }
  //////////////////////////////////////////////////////////
  update(delta){
    const now = Date.now();
    for ( let nick in this.dict){
      this.dict[nick].update(delta, now);
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

    // copy entire model
    p.copy(this.model);

    // scale
    const s = SIZE/6;// was2
    //const s = SIZE/2;// was4
    p.scale.set(s,s,s);

    p.name = nick;

    this.world.scene.add(p);
    p.castShadow = true;
    let newPlayer = new Player(p, nick, (isRed===1), this.sound, this.useShooting);

    this.dict[nick] = newPlayer;
    console.log('create player',nick);
	  return newPlayer;
  }
  //////////////////////////////////////////////////////////
  all(){
    let all = [];
    for ( let nick in this.dict){
      all.push(this. dict[nick].obj);
    }
    return all;
  }
  //////////////////////////////////////////////////////////
  boundSpheres() {
    let all = [];
    for ( let nick in this.dict){
      all.push(this. dict[nick].boundSphere);
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
  //////////////////////////////////////////////////////////
  initShooting(enabled){
    this.useShooting = enabled;
  }
}
window.Players = Players;
