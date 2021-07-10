
function explodeMngr(){
  //////////////settings/////////
  var movementSpeed = 80;
  var totalObjects = 1000;
  var objectSize = 10;
  var sizeRandomness = 4000;
  var colors = [0xFF0FFF, 0xCCFF00, 0xFF000F, 0x996600, 0xFFFFFF];
  /////////////////////////////////
  var dirs = [];
  var parts = [];
  // var container = document.createElement('div');
  // document.body.appendChild( container );

  //////////////////////////////////////////////////////////////////////
  function ExplodeAnimation(x,y)
  {
    var geometry = new THREE.Geometry();

    for (i = 0; i < totalObjects; i ++)
    {
      var vertex = new THREE.Vector3();
      vertex.x = x;
      vertex.y = y;
      vertex.z = 0;

      geometry.vertices.push( vertex );
      dirs.push({x:(Math.random() * movementSpeed)-(movementSpeed/2),y:(Math.random() * movementSpeed)-(movementSpeed/2),z:(Math.random() * movementSpeed)-(movementSpeed/2)});
    }
    var material = new THREE.ParticleBasicMaterial( { size: objectSize,  color: colors[Math.round(Math.random() * colors.length)] });
    var particles = new THREE.ParticleSystem( geometry, material );

    this.object = particles;
    this.status = true;

    this.xDir = (Math.random() * movementSpeed)-(movementSpeed/2);
    this.yDir = (Math.random() * movementSpeed)-(movementSpeed/2);
    this.zDir = (Math.random() * movementSpeed)-(movementSpeed/2);

    scene.add( this.object  );

    this.update = function(){
      if (this.status == true){
        var pCount = totalObjects;
        while(pCount--) {
          var particle =  this.object.geometry.vertices[pCount]
          particle.y += dirs[pCount].y;
          particle.x += dirs[pCount].x;
          particle.z += dirs[pCount].z;
        }
        this.object.geometry.verticesNeedUpdate = true;
      }
    }

  }

  //parts.push(new ExplodeAnimation(0, 0));
  //render();
  //////////////////////////////////////////////////////////////////////
  function beforeRender() {
    //requestAnimationFrame( render );

    var pCount = parts.length;
    while(pCount--) {
      parts[pCount].update();
    }

    //renderer.render( scene, camera );
  }
  //////////////////////////////////////////////////////////////////////
  function create(x, y) {
    parts.push(new ExplodeAnimation(x, y));
  }
  return {
    ExplodeAnimation:ExplodeAnimation,
    beforeRender:beforeRender,
    create:create
  }
}

// window.addEventListener( 'mousedown', onclick, false );
// window.addEventListener( 'resize', onWindowResize, false );

// function onclick(){
//   event.preventDefault();
//   parts.push(new ExplodeAnimation((Math.random() * sizeRandomness)-(sizeRandomness/2), (Math.random() * sizeRandomness)-(sizeRandomness/2)));
// }

// function onWindowResize() {
// 				camera.aspect = window.innerWidth / window.innerHeight;
// 				camera.updateProjectionMatrix();

// 				renderer.setSize( window.innerWidth, window.innerHeight );

// 			}
