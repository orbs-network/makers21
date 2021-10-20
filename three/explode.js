
function ExplodeMngr(scene){
  //////////////settings/////////
  const SECONDS = 2;
  var movementSpeed = SIZE/100;
  var totalObjects = 1000;
  //var objectSize = 0.03;
  //var sizeRandomness = 4000;
  //var colors = [0xFF0FFF, 0xCCFF00, 0xFF000F, 0x996600, 0xFFFFFF];
  /////////////////////////////////
  var dirs = [];
  var parts = [];
  // var container = document.createElement('div');
  // document.body.appendChild( container );

  //////////////////////////////////////////////////////////////////////
  function ExplodeAnimation(x,y,z, isRed)
  {
    var geometry = new THREE.BufferGeometry();

    // attributes
    const positions = new Float32Array( totalObjects * 3 ); // 3 vertices per point
    geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

    let index=0;
    for (let i = 0; i < positions.length; i++)
    {
      // var vertex = new THREE.Vector3();
      // vertex.x = x;
      // vertex.y = y;
      // vertex.z = 0;
      positions[ index ++ ] = x;
      positions[ index ++ ] = y;
      positions[ index ++ ] = z;


      //geometry.vertices.push( vertex );
      dirs.push({x:(Math.random() * movementSpeed)-(movementSpeed/2),y:(Math.random() * movementSpeed)-(movementSpeed/2),z:(Math.random() * movementSpeed)-(movementSpeed/2)});
      this.particles = positions;
    }
    // var material = new THREE.PointsMaterial( {
    //   size: objectSize//,
    //   //color: colors[Math.round(Math.random() * colors.length)]
    //   // transparent: true,
    //   // opacity:1,
    //   // blending: THREE.multiplyBlending,
    //   // flatShading: true,
    //   // depthTest: true,
    //   // sizeAttenuation: true
    // });
    var particles = new THREE.Points( geometry, isRed? materials.redExplode : materials.blueExplode);

    this.object = particles;
    this.status = true;

    this.xDir = (Math.random() * movementSpeed)-(movementSpeed/2);
    this.yDir = (Math.random() * movementSpeed)-(movementSpeed/2);
    this.zDir = (Math.random() * movementSpeed)-(movementSpeed/2);

    scene.add( this.object  );
    this.started = Date.now();

    // animation
    this.update = function(age){
      if (this.status == true){
        var index = 0;
        var count = totalObjects;
          const explosionColors = isRed ? explosionRedColors : explosionBlueColors;

          while(--count) {
          //var particle =  this.object.geometry.vertices[index]
          this.particles[index++] += dirs[count].y * Math.random() * (Math.random() > 0.2 ? 1 : -1) ;
          this.particles[index++] += dirs[count].x * Math.random() * (Math.random() > 0.2 ? 1 : -1);
          this.particles[index++] += dirs[count].z * Math.random() * (Math.random() > 0.2 ? 1 : -1);
          const explosionPhase = Math.abs(1-(age/2));
          this.object.material.opacity = explosionPhase;
          this.object.material.color.set(explosionColors[Math.floor((age/2) * 10)]);
          // var particle = this.particles[pCount];
          // particle.y += dirs[pCount].y;
          // particle.x += dirs[pCount].x;
          // particle.z += dirs[pCount].z;
        }

        //this.object.geometry.verticesNeedUpdate = true;
        this.object.geometry.attributes.position.needsUpdate = true;
      }
    }

  }

  //parts.push(new ExplodeAnimation(0, 0));
  //render();
  //////////////////////////////////////////////////////////////////////
  function beforeRender() {
    //requestAnimationFrame( render );

    var pCount = parts.length;
    const now = Date.now();
    let ended = [];
    while(pCount--) {

      let age = (now - parts[pCount].started) / 1000;

      if ( age < SECONDS ){
        parts[pCount].update(age);

      }
      else{
        ended.push(pCount);
      }
    }

    // cleanup ended
    for( let i of ended){
      const inst = parts[i];
      // remove from scene
      scene.remove(inst.object);
      // remove from memory
      parts.splice(i,1);
    }

    //renderer.render( scene, camera );
  }
  //////////////////////////////////////////////////////////////////////
  function create(x, y, z, isRed) {
    const part = new ExplodeAnimation(x, y, z, isRed);

    // sound
    // if(this.sound){
    //   const loop = false;
    //   const vol = 0.8; //loudest
    // }
    //this.sound.add('explode.wav', part.object, loop,  config.size, vol);

    parts.push(part);
    //parts.push(new ExplodeAnimation((x * sizeRandomness)-(sizeRandomness/2), (y * sizeRandomness)-(sizeRandomness/2)));
  }
  //////////////////////////////////////////////////////////////////////
  // function initSound(sound) {
  //   this.sound = sound;
  // }
  //////////////////////////////////////////////////////////////////////
  return {
    beforeRender:beforeRender,
    create:create
  }
}

const explosionRedColors =[

    "#ffffff",
    "#ffdbdb",
    "#ffd0d0",
    "#ffa1a1",
    "#ff9393",
    "#ff5b5b",
    "#ff2e2e",
    "#ff0000",
    "#9e0000",
    "#840000",
    "#2a0000",
];

const explosionBlueColors =[

    "#ffffff",
    "#ced4ff",
    "#cfd6ff",
    "#a1b9ff",
    "#93aaff",
    "#5b76ff",
    "#2e62ff",
    "#0037ff",
    "#00159e",
    "#001d84",
    "#00092a",
];