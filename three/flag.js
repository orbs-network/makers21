class Flags  {
  //////////////////////////////////////////////////////////
  constructor(){
	  this.manager = new THREE.LoadingManager();
	  this.loader = new THREE.OBJLoader();
		this.dict ={};
		this.gates ={};
  }
	//////////////////////////////////////////////////////////
  createFlag(model, scene, gate, name, color, scale) {
		let object = new THREE.Object3D();
    object.copy(model);

		// set material and color
		object.traverse( function ( child ) {
			if ( child instanceof THREE.Mesh ) {
				child.material.color.setHex(color);
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
	attachTo(name, parent) {
		const obj = this.dict[name];

		// detach first
		//obj.remove();
		// attach
		parent.add(obj);
	}
	//////////////////////////////////////////////////////////
	setPosCamera(name) {
		const obj = this.dict[name];
		obj.position.z = -SIZE/1.8;
		obj.position.y = 3;
		obj.position.x = 0;
	}
}
