class Flags  {
  //////////////////////////////////////////////////////////
  constructor(){
	  this.manager = new THREE.LoadingManager();
	  this.loader = new THREE.OBJLoader();

  }

  createFlag(scene, name, scale, position) {
	  // load a resource
	  this.loader.load(
		  // resource URL
		  'model/paper/flag.obj',
		  // called when resource is loaded
		  function ( object ) {

			  object.name = name;
			  object.visible = true;

			  object.scale.set(scale, scale, scale);
			  object.position.x = position['x'];
			  object.position.y = position['y'];
			  object.position.z = position['z'];

			  // object.getWorldDirection(v3);
			  // object.castShadow = true;
			  scene.add( object );

		  },
		  // called when loading is in progresses
		  function ( xhr ) {

			  console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

		  },
		  // called when loading has errors
		  function ( error ) {

			  console.log( 'An error happened: ', error);

		  }
	  );

  }

}
