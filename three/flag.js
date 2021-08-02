class Flags  {
  //////////////////////////////////////////////////////////
  constructor(){
		this.dict ={};
		this.gates ={};
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
		obj.position.z = -SIZE/3;
		obj.position.y = 1.5;
		obj.position.x = 0;
	}
}
