let v3 = new THREE.Vector3(0,0,0);
const lookDistance = SIZE*2;

//////////////////////////////////////////////////////////
class Player{
  //////////////////////////////////////////////////////////
  constructor(obj, nick, isRed, sound, useShooting){
    this.obj = obj;
    this.moving = false;
    this.isRed = isRed;
    this.gameJoined = false;
    this.nick = nick;
    this.verticalLookRatio = Math.PI / ( game.controls.verticalMax - game.controls.verticalMin );
    //this.go2Target = false;
    this.dir = new THREE.Vector3();
    //this.lastPosTS = 0;

    //obj.rotation.y = -1;

    this._initLabel(nick, isRed);

    // create sounds
    if(sound){ // might be undefined when players added before user started flying
      this.addSound(sound);
    }
    // DO BEFORE SHOOTING SO IT DOESNT REPLACE ADDED SPHERE MATTERIAL
    this.setMaterialColor(isRed);


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

    // useShooting
    this.useShooting = useShooting;
    if(useShooting){
      // bounding sphere
      const geometry = new THREE.SphereGeometry( 320 * config.playSphereFactor, 16, 8 );
      // create new matterial per sphere so opacity can be changed individually
      this.boundSphere = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: isRed? 0xFF0000:0x0000FF } ) );
      this.boundSphere.layers.enable(1); // MUST
      this.boundSphere.material.transparent = true;
      //this.boundSphere.position.z = 90;
      this.boundSphere.name = nick + '_bound_sphere';
      //this.boundSphere.scale.set(2400,2400,2400);
      this.boundSphere.material.opacity = 0;
      //this.boundSphere.visible = false;// invisible
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
  showBoundingSphere(show){
    this.boundSphere.material.opacity = show? 0.3 : 0;
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
    this.trgtMS += delta;
    if(this.moving && this.go2Target){
      let indx = Math.floor(this.trgtMS / config.sampleInterval);
      if(indx >= this.xPerMS.length) {
        //console.log('sampleInterval index out of range');
        return;
      }
      if(indx != this.index){
        this.index = indx;

        this.obj.position.set(this.posData.sample.posX[indx], this.posData.sample.posY[indx], this.posData.sample.posZ[indx]);
        this.obj.lookAt(this.posData.sample.dirX[indx] * lookDistance, this.posData.sample.dirY[indx] * lookDistance,this.posData.sample.dirZ[indx] * lookDistance);
        return;
      }
      //console.log(delta, indx);

      this.obj.position.x += this.xPerMS[indx] * delta;
      this.obj.position.y += this.yPerMS[indx] * delta;
      this.obj.position.z += this.zPerMS[indx] * delta;

      this.dir.x += this.rxPerMS[indx] * delta;
      this.dir.y += this.ryPerMS[indx] * delta;
      this.dir.z += this.rzPerMS[indx] * delta;

      //this.obj.lookAt(this.dir.x * lookDistance, this.dir.y * lookDistance, this.dir.z * lookDistance);
    }
      // // NEW
      // //if(this.go2Target){
      //   // Position
      //   this.obj.position.x += this.xPerMS * delta;
      //   this.obj.position.y += this.yPerMS * delta;
      //   this.obj.position.z += this.zPerMS * delta;
      //   // Rotation
      //   //this.obj.rotation.set(direction);
      //   this.obj.rotateOnAxis(new THREE.Vector3(0,1,0), this.xRadMS * delta);
      //   this.obj.rotateOnAxis(new THREE.Vector3(1,0,0), this.yRadMS * delta);
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
    //}
  }//////////////////////////////////////////////////////////
  hadPos(){
    // return false if all zero
    return(this.obj.position.x || this.obj.position.y || this.obj.position.z );
  }
  //////////////////////////////////////////////////////////
  onPos(data){
    //this.lastPosTS = data.targetTS;
    // direction
    //this.obj.lookAt(data.dir.x * lookDistance, data.dir.y * lookDistance, data.dir.z * lookDistance);

    // position if not moving
    this.go2Target = false;
    this.moving = data.moving;

    // necesseraly
    this.exploding = false;
    this.show();

    // let xTrgt = data.sample.x;//.split(',');
    // let yTrgt = data.sample.y;//.split(',');
    // let zTrgt = data.sample.z;//.split(',');

    //console.log("onPos len=", data.sample.len);
    // if(!this.hadPos() ){
    //   this.obj.position.set(data.sample.posX.shift(), data.sample.posY.shift(), data.sample.posZ.shift());
    //   this.obj.lookAt(data.sample.dirX.shift() * lookDistance, data.sample.dirY.shift() * lookDistance, data.sample.dirZ.shift() * lookDistance);
    //   //data.sample.len -=1;
    // }
    //else{
      //this.obj.lookAt(data.sample.dirX[0] * lookDistance, data.sample.dirY[0] * lookDistance, data.sample.dirZ[0] * lookDistance);
    //}

    if(!this.hadPos() ){
      this.obj.position.set(data.sample.posX[0], data.sample.posY[0], data.sample.posZ[0]);
      return;
    }
    if(!this.moving) return;

    // important??? or time?
    //game.world.camera.updateMatrixWorld();
    //this.obj.updateMatrixWorld();
    this.obj.updateMatrix();

    // Position
    this.posData = data;
    this.go2Target = true;
    this.xPerMS = [];
    this.yPerMS = [];
    this.zPerMS = [];
    this.rxPerMS = [];
    this.ryPerMS = [];
    this.rzPerMS = [];
    this.obj.getWorldDirection(this.dir);
    let src = this.obj.position.clone();
    let rSrc = this.dir; // just for code elegancy


    this.trgtIndx = 0;
    this.trgtMS = 0;
    for(let i=0; i < data.sample.len; ++i){
      // pos
      this.xPerMS.push((data.sample.posX[i] - src.x) / config.sampleInterval);
      this.yPerMS.push((data.sample.posY[i] - src.y) / config.sampleInterval);
      this.zPerMS.push((data.sample.posZ[i] - src.z) / config.sampleInterval);
      // dir/rot
      this.rxPerMS.push((data.sample.dirX[i] - rSrc.x) / config.sampleInterval);
      this.ryPerMS.push((data.sample.dirY[i] - rSrc.y) / config.sampleInterval);
      this.rzPerMS.push((data.sample.dirZ[i] - rSrc.z) / config.sampleInterval);

      // for next round
      src.x = data.sample.posX[i];
      src.y = data.sample.posY[i];
      src.z = data.sample.posZ[i];

      rSrc.x = data.sample.dirX[i];
      rSrc.y = data.sample.dirY[i];
      rSrc.z = data.sample.dirZ[i];
    }
    // // rotation
    // let lon = -data.mouseX * game.controls.lookSpeed;
    // let lat = data.mouseY * game.controls.lookSpeed;
    // this.xRadMS = THREE.MathUtils.degToRad( lon );
    // this.yRadMS = THREE.MathUtils.degToRad( lat );

  }
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
    if(this.tidLock){
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
    if(this.tidLock){
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
    this.tidLock = setTimeout(() =>{
      this.onLockOff(data, target);
      this.tidLock = 0;
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
    playerLabelDiv.style.color = isRed ? '#F00':'#00F';
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
      if(p.tidLock){
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
      console.log(`Player ${data.id} ${data.nick} not in this game`); // ignore
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
        game.setGameMsg(`${data.nick} got exploded`);
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
    const s = SIZE/20000;// was 30000 but adjusted to ship model
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
