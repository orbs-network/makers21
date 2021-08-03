class Flags  {
  //////////////////////////////////////////////////////////
  constructor(){
		this.dict ={};
		this.parent ={};
		this.gates ={};
		this.airplanePos = new THREE.Vector3(0,0,0);
  }
	//////////////////////////////////////////////////////////
  createFlag(object, scene, gate, name, color, scale) {
		// set material and color
		object.traverse( function ( child ) {
			if ( child instanceof THREE.Mesh ) {
				child.material.color.set(color);
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
  }
	//////////////////////////////////////////////////////////
	moveToGate(name) {
		const obj = this.dict[name];
		const gate = this.gates[name];

		var bbox = new THREE.Box3().setFromObject(obj);
		obj.position.z = gate.position.z;
		obj.position.y = gate.position.y - bbox.getSize().y /2;
	}
	//////////////////////////////////////////////////////////
	detach(name) {
		const flag = this.dict[name];
		if(this.parent[name]){
			//this.parent[name].remove(flag);
			this.parent[name] = null;
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
		parent.attach(obj);
		// keep for detach
		this.parent[name] = parent;
	}
	//////////////////////////////////////////////////////////
	setPosCamera(name) {
		let obj = this.dict[name];
		obj.position.set(0, 1.5, -SIZE/3);
	}
	//////////////////////////////////////////////////////////
	setAirplanePosition(name) {
		console.log("setAirplanePosition", name);
		let obj = this.dict[name];

		obj.position.set(0,SIZE/100,0);
		//obj.updateMatrixWorld(true);
		//obj.parent.updateMatrixWorld(true);

		// obj.position.z = 0;
		// //obj.position.y = SIZE/20;
		// obj.position.y = 0;
		// obj.position.x = 0;
	}
	//////////////////////////////////////////////////////////
	rotate(speed) {
		if(Object.keys(this.dict).length == 2){
			this.dict['red'].rotateY(config.gateSpeed/3);// rotation.y -= speed;
			this.dict['blue'].rotateY(-config.gateSpeed/3);// rotation.y += config.gateSpeed;
		}
	}
}
