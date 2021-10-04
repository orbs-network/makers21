class Flags  {
  //////////////////////////////////////////////////////////
  constructor(){
		this.dict ={};
		this.holders ={};
		this.gates ={};
		this.airplanePos = new THREE.Vector3(0,0,0);
  }
	//////////////////////////////////////////////////////////
  createFlag(object, scene, gate, name, color, scale, sound) {
		// set material and color
		object.traverse( function ( child ) {
			if ( child instanceof THREE.Mesh ) {
				child.material.side =  THREE.DoubleSide;
				child.material.color.set(color);
				//child.material = color=='red'? materials.redPhong : materials.bluePhong;
			}
		});

		object.name = name;
		object.visible = true;
		object.scale.set(scale, scale, scale);

		// insert to dict
		this.dict[name] = object;
		this.gates[name] = gate;

		// center down
		this.moveToGate(name);
		scene.add( object );

		// add sound
		// const distance= config.size * 1.5;
		// const volume= 0.5;
		// const duration= 0.3;
		// //add(name, obj, loop, refDistance, volume, duration){
		// sound.add('flag.wav', object, true, volume, distance, volume, 1.5);
  }
	//////////////////////////////////////////////////////////
	moveToGate(name) {
		const flag = this.dict[name];
		const gate = this.gates[name];

		var bbox = new THREE.Box3().setFromObject(flag);
		let v3 = new THREE.Vector3 (0,0,0);
		bbox.getSize(v3)

		flag.position.x = gate.position.x;
		flag.position.z = gate.position.z;
		flag.position.y = gate.position.y - v3.y /2;
	}
	//////////////////////////////////////////////////////////
	detach(name) {
		const flag = this.dict[name];
		if(this.holders[name]){
			//this.holders[name].remove(flag);
			this.holders[name] = null;
		}
		return flag;
	}
	//////////////////////////////////////////////////////////
	attachTo(name, parent) {
		const obj = this.dict[name];
		// attach
		//parent.add(obj);
		//parent.updateMatrixWorld(true);
		//obj.updateMatrix();
		//parent.attach(obj);
		// keep for detach
		this.holders[name] = parent;
	}
	//////////////////////////////////////////////////////////
	// setPosCamera(name) {
	// 	let obj = this.dict[name];
	// 	obj.position.set(0, 1.5, -SIZE/3);
	// 	// let sound = obj.getObjectByName('sound_flag');
	// 	// if(sound){
	// 	// 	sound.pause();
	// 	// }
	// }
	// //////////////////////////////////////////////////////////
	// setPosPlayer(name) {
	// 	console.log("setPosPlayer", name);
	// 	// let obj = this.dict[name];

	// 	// obj.position.set(0, SIZE/500, 0);

	// 	// let sound = obj.getObjectByName('sound_flag');
	// 	// if(sound){
	// 	// 	sound.play();
	// 	// }
	// }
	//////////////////////////////////////////////////////////
	update(rad) {
		// implement parent movement
		for(let flagName in this.holders){
			const flag = this.dict[flagName];
			const holder = this.holders[flagName];
			if(holder && holder.obj){
				flag.position.set(holder.obj.position.x, holder.obj.position.y + 0.05, holder.obj.position.z);
			}
		}
		// rotate
		if(Object.keys(this.dict).length == 2){
			this.dict['red'].rotateY(rad*10);// rotation.y -= speed;
			this.dict['blue'].rotateY(-rad*10);// rotation.y += config.gateSpeed;
		}
	}
}
