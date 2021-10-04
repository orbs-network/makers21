let v3 = new THREE.Vector3(0,0,0);
const lookDistance = 1000;

//////////////////////////////////////////////////////////
class Player{
  //////////////////////////////////////////////////////////
  constructor(obj, nick, isRed, sound, useShooting){
    this.obj = obj;
    this.moving = false;
    this.isRed = isRed;
    this.gameJoined = false;
    this.nick = nick;
    //this.go2Target = false;
    //this.targetPos = new THREE.Vector3();
    this.lastPosTS = 0;

    obj.rotation.y = -1;

    this._initLabel(nick, isRed);



    // create sounds
    if(sound){ // might be undefined when players added before user started flying
      this.addSound(sound);
    }
    // DO BEFORE SHOOTING SO IT DOESNT REPLACE ADDED SPHERE MATTERIAL
    this.setMaterialColor(isRed);

    // useShooting
    this.useShooting = useShooting;
    if(useShooting){
            // bounding sphere
      const geometry = new THREE.SphereGeometry( config.playerSphereSize, 16, 8 );
      // create new matterial per sphere so opacity can be changed individually
      this.boundSphere = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: isRed? 0xFF0000:0x0000FF } ) );
      this.boundSphere.layers.enable(1); // MUST
      this.boundSphere.material.transparent = true;
      this.boundSphere.position.z = 90;
      this.boundSphere.name = nick + '_bound_sphere';
      this.boundSphere.scale.set(2400,2400,2400);
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



    // SUPER SIMPLE GLOW EFFECT
    // use sprite because it appears the same from all angles
    const spriteMaterial = new THREE.SpriteMaterial(
        {
          map: new THREE.ImageUtils.loadTexture( 'images/nova_1.png' ),
          depthWrite: false,
          color: isRed? 0xffaaaa:0x9999ff , blending: THREE.AdditiveBlending
        });

    const sprite = new THREE.Sprite( spriteMaterial );
    sprite.scale.set(300, 300, 1.0);
    sprite.position.z  = -180;
    sprite.position.x  = -30;
    obj.add(sprite);


  }
  //////////////////////////////////////////////////////////
  showBoundingSphere(show){

    if (show) {
      this.boundSphere.material.opacity = 0.5;
      this.boundSphere.scale.set(24000, 24000, 24000);
    } else {
      this.boundSphere.material.opacity = 0;
      this.boundSphere.scale.set(24000, 24000, 24000);
    }

  }
  //////////////////////////////////////////////////////////
  setMaterialColor(red){
    this.obj.children[0].material.emissive.set(red  ? RED_SHIP :  BLUE_SHIP);
  }
  //////////////////////////////////////////////////////////
  addSound(sound){
    sound.add('fly-by.wav', this.obj, true, config.size/5);
    sound.add('explode.wav', this.obj, false, config.size/2, 1);
    sound.add('laser.wav', this.obj, false, config.size/5, 1);
    sound.add('laser_up.wav', this.obj, false, config.size/5, 1);
    sound.add('laser_down.wav', this.obj, false, config.size/5, 1);
  }
  //////////////////////////////////////////////////////////
  update(delta){
    //this.obj.position.set(this.targetPos.x, this.targetPos.y, this.targetPos.z);
    if(this.moving && this.go2Target){
      // NEW
      //if(this.go2Target){
        // Position
        this.obj.position.x += this.xPerMS * delta;
        this.obj.position.y += this.yPerMS * delta;
        this.obj.position.z += this.zPerMS * delta;
        // Rotation
        // this.obj.rotation.x += this.xRotPerMS * delta;
        // this.obj.rotation.y += this.yRotPerMS * delta;
        // this.obj.rotation.z += this.zRotPerMS * delta;
      //}else{
        // OLD
        // console.error('player::update CALL YUVAL');
        // this.obj.position.set(this.targetPos);
        // this.obj.getWorldDirection(v3);
        // //const direction = v3.multiplyScalar(-config.speed);
        // let distance = config.distancePerMS * delta ;
        // const direction = v3.multiplyScalar(-distance);
        // this.obj.position.add(direction);
      //}
    }
  }//////////////////////////////////////////////////////////
  hadPos(){
    // return false if all zero
    return(this.obj.position.x || this.obj.position.y || this.obj.position.z );
  }
  //////////////////////////////////////////////////////////
  onPos(data){
    if(data.targetTS <= this.lastPosTS){
      console.error('OLD TS MSG', data.targetTS ,this.lastPosTS);
      return;
    }
    this.lastPosTS = data.targetTS;
    // direction
    this.obj.lookAt(data.dir.x * lookDistance, data.dir.y * lookDistance, data.dir.z * lookDistance);

    // position if not moving
    this.go2Target = false;
    this.moving = data.moving;
    let timeToTarget = data.targetTS - Date.now();

    // necesseraly
    this.exploding = false;
    this.show();

    if(!this.moving || !this.hadPos() || timeToTarget <= 0){
      this.obj.position.set(data.targetPos.x, data.targetPos.y, data.targetPos.z);
      return;
    }

    // Position
    this.go2Target = true;
    this.xPerMS = (data.targetPos.x - this.obj.position.x) / timeToTarget;
    this.yPerMS = (data.targetPos.y - this.obj.position.y) / timeToTarget;
    this.zPerMS = (data.targetPos.z - this.obj.position.z) / timeToTarget;
      // if(!this.xPerMS || !this.yPerMS || !this.zPerMS){
      //   this.go2Target = false;
      //   console.log('isNan happened');
      // }
      // Rotation
      //this.obj.applyQuaternion(data.quaternion);
      //this.obj.setRotationFromQuaternion(data.quaternion);
      // this.obj.getWorldDirection(v3);
      // this.xRotPerMS = (data.dir.x - v3.x) / timeToTarget;
      // this.yRotPerMS = (data.dir.y - v3.y) / timeToTarget;
      // this.zRotPerMS = (data.dir.z - v3.z) / timeToTarget;
    // }else{
    //   this.go2Target = false;
    //   //this.obj.position.set(data.targetPos.x, data.targetPos.y, data.targetPos.z);
    // }
  }
  //////////////////////////////////////////////////////////
  // onStart(data){
  //   // abort future lockOff
  //   if(this.tidLockOff){
  //     clearTimeout(this.tidLock);
  //     this.tidLock = 0;
  //   }

  //   this.moving = data.moving;
  //   this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
  // }
  //////////////////////////////////////////////////////////
  onExplode(data, explode){
    this.exploding = data.flag;

    // finished exploding
    if(!this.exploding){
      this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
      this.obj.rotation.set(data.dir.x, data.dir.y, data.dir.z);
      this.show(true);
      return;
    }

    // abort future lockOff
    if(this.tidLockOff){
      clearTimeout(this.tidLock);
      this.tidLock = 0;
    }

    // hide exploding airplaine
    this.moving = false;
    // hide exploding
    this.show(false);
    // show again after return to start
    if(this.tidWaitReturn){
      clearTimeout(this.tidWaitReturn);
    }
    // this.tidWaitReturn = setTimeout(()=>{
    //   this.tidWaitReturn = 0;
    //   this.show(true)
    // },config.return2startSec * 1000)

    // create explosition attached to player
    explode.create(this.obj.position.x, this.obj.position.y, this.obj.position.z, this.isRed);

    // for positional sound
    this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);

    // play already installed sound
    let sound = this.obj.getObjectByName('sound_explode.wav');
    if(sound) sound.play();
  }
  //////////////////////////////////////////////////////////
  onFire(data){
    // abort future lockOff
    if(this.tidLockOff){
      clearTimeout(this.tidLock);
      this.tidLock = 0;
    }
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
  onLockOn(data, target){
    // play already installed sound
    let sound = this.obj.getObjectByName('laser_up.wav');
    if(sound) sound.play();

    // timer for lock off
    this.tidLockOff = setTimeout(() =>{
      this.onLockOff(data, target);
      this.tidLockOff = 0;
    }, config.targetLockMs)

  }
  //////////////////////////////////////////////////////////
  onLockOff(data, target){
    // play already installed sound
    let sound = this.obj.getObjectByName('laser_down.wav');
    if(sound) sound.play();
  }
  //////////////////////////////////////////////////////////
  onLock(data, target){
    if(data.on){
      this.onLockOn(data,target);
    }else{
      this.onLockOff(data,target);
    }
    if(target){
      target.showBoundingSphere(data.on);
    }
  }
  //////////////////////////////////////////////////////////
  show(flag) {
    // explicit hide
    if (flag !== false) flag = true;
    this.obj.visible = flag;
    this.playerLabelObj.visible = flag;
  }
  //////////////////////////////////////////////////////////
  _initLabel(nick, isRed) {
    const playerLabelDiv = document.createElement( 'div' );
    playerLabelDiv.className = 'player-label';
    playerLabelDiv.textContent = nick || "WHO DIS?";
    playerLabelDiv.style.color = isRed ? '#F33':'#33F';
    this.playerLabelObj = new THREE.CSS2DObject( playerLabelDiv );
    this.playerLabelObj.position.set( 0, 0, 0 );
    this.obj.add( this.playerLabelObj );
  }
}

class Players{
  //////////////////////////////////////////////////////////
  constructor(world){
    this.dict = {};
    this.world= world;
    this.model = world.models['airplane'];

    this.useShooting = false;

    deepStream.subscribe("player", this.onEvent.bind(this));

  }
  //////////////////////////////////////////////////////////
  reset(){
    // hide objects from scene
    for(let p of this.all()){
      p.visible = false;
      // if(p.playerLabelObj){
      //   p.playerLabelObj.visible = false;
      // }

      // abort future lockOff
      if(p.tidLockOff){
        clearTimeout(this.tidLock);
        p.tidLock = 0;
      }
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

    //  if(data.targetPos)    console.log(`event type:${data.type}`,data.targetPos);

    switch(data.type){
      // case "start":
      //   p.onStart(data);
      //   break;
      case "pos":
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
      case "lockOn":
        p.onLock(data, this.getPlayer(data.targetNick));
        // warn myself if im the target
        game.checkLockOnTarget(data);
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
    const s = SIZE/30000;// was4
    p.scale.set(s,s,s);

    p.name = nick;

    this.world.scene.add(p);
    p.castShadow = true;
    //p.visible = false; // until positioned
    let newPlayer = new Player(p, nick, (isRed===1), this.sound, this.useShooting);
    //newPlayer.show(false);

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
    // this player
    if(nick === game.localState.nick)
      return null;

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
