class World {
    //////////////////////////////////////////////////////////
    constructor() {
        this.border = {};
        this.flags = new Flags();
        this.worldPos = new THREE.Vector3();
        this.worldDir = new THREE.Vector3();

        this.loader = new THREE.OBJLoader();
        this.models = {};
        this.v2 = new THREE.Vector2(0, 0);

        this.msPerTurn = (1000 / config.gateTurnPerSec);
        this.gateRad = Math.PI * 2 / this.msPerTurn;// rotation.y -= config.gateSpeed;

        this.disableGateRotation = localStorage.getItem("disableGateRotation");
        this.simpleRendering = localStorage.getItem("simpleRendering");
        this.disableSound = localStorage.getItem("disableSound");

    }

    //////////////////////////////////////////////////////////
    reset() {
        if (this.tidReturn) {
            clearInterval(this.tidReturn);
            this.tidReturn = null;
        }
        this.players.reset();
    }

    //////////////////////////////////////////////////////////
    loadShip(name) {

        return THREEx.SpaceShips.loadSpaceFighter01((object3d) => {
            // object3d is the loaded spacefighter
            // now we add it to the scene

            object3d.children[0].material = new THREE.MeshPhongMaterial({
                map: new THREE.TextureLoader().load('models/SpaceFighter01/F01_512.jpg'),
                // color: 0xff3333,
                specular: 0xffffff,
                shininess: 100,
                reflectivity: 0.3
            });

            this.models[name] = object3d;

        })

    }

    loadModel(name) {
        return new Promise((resolve, reject) => {
            // load a resource
            this.loader.load(
                // resource URL
                'model/' + name + '.obj',
                // called when resource is loaded
                (object) => {
                    console.log('100% loaded');
                    // default white
                    object.traverse(function (child) {
                        if (child instanceof THREE.Mesh)
                            child.material.color.setRGB(1, 1, 1);
                    });
                    this.models[name] = object;
                    resolve();
                },
                // called when loading is in progresses
                function (xhr) {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                // called when loading has errors
                function (error) {
                    console.log('An error happened: ', error);
                    reject();
                }
            );
        });
    }

    createModelClone(name) {
        //let object = new THREE.Object3D();
        //object.copy(model);
        let clone = this.models[name].clone();
        clone.traverse((node) => {
            if (node.isMesh) {
                node.material = node.material.clone();
            }
        });
        return clone;
    }

    //////////////////////////////////////////////////////////
    loadModels(cb) {
        let arr = [];
        arr.push(this.loadShip('airplane'));
        arr.push(this.loadModel('flag'));
        Promise.all(arr).then(cb);
    }

    //////////////////////////////////////////////////////////
    createScene() {
        this.scene = new THREE.Scene();
        this.explode = new ExplodeMngr(this.scene);

        this.createCamera();

        // renderer
        this._renderer = new THREE.WebGLRenderer();
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this._renderer.domElement);

        // postprocessing
        this.composer = new THREE.EffectComposer(this._renderer);
        this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));

        this.afterImagePass = new THREE.AfterimagePass();

        this.composer.addPass(this.afterImagePass);
        this.turnWarningEffect(false);

        // for colision and shooting
        this.raycaster = new THREE.Raycaster();
        //this.raycaster.layers.set( 1 );

        ///////////////////////////////
        // Light
        // ambient light to light all objects equally
        const amb = new THREE.AmbientLight(0x222222); // soft white light
        this.scene.add(amb);
        let light = new THREE.DirectionalLight(0xffffff, 1.5, 100);
        //let light = new THREE.HemisphereLight( 0xfffff0, 0x101020, 0.2 )
        light.position.set(1, 0.25, 0); //default; light shining from top
        light.castShadow = true; // default false
        this.scene.add(light);

        // helper for size
        // const axesHelper = new THREE.AxesHelper( SIZE );
        // this.scene.add( axesHelper );


        // // const skyColor = 0xB1E1FF;  // light blue
        // // const groundColor = 0xB97A20;  // brownish orange
        // // const intensity = 1;


        // create players
        this.players = new Players(this);

        // GATES
        const GATE_SIZE = config.size / 30;
        // red gate
        this.redGate = this.createGate(RED2, GATE_SIZE);
        this.redGate.name = "redGate";

        const gateY = SIZE / 2 + GATE_SIZE;

        const gatePosFactor = 1.4;//almost at border
        // move front and up
        this.redGate.position.z = -SIZE * gatePosFactor;
        this.redGate.position.y = gateY;
        this.scene.add(this.redGate);
        // pass
        this.redGate.passSphere = new THREE.Sphere(this.redGate.position, GATE_SIZE / gatePosFactor);

        // blue gate
        this.blueGate = this.createGate(BLUE2, GATE_SIZE);
        this.blueGate.name = "blueGate";

        // move back and up
        this.blueGate.position.z = SIZE * gatePosFactor;
        this.blueGate.position.y = gateY;
        this.scene.add(this.blueGate);
        // pass
        this.blueGate.passSphere = new THREE.Sphere(this.blueGate.position, GATE_SIZE / 1.5);

        // Flags
        this.flags.createFlag(this.createModelClone('flag'), this.scene, this.blueGate, 'red', 0xFF0000, .002, this.sound);
        this.flags.createFlag(this.createModelClone('flag'), this.scene, this.redGate, 'blue', 0x0000FF, .002, this.sound);

        // create red+blue borders & ceeling
        this.createBorders(RED, 1);
        this.createBorders(BLUE, -1);

        // sound
        //init from user ket down in game this.initSound();
        // or is it ok to init here, and only play when user action?

        if (!this.disableSound) {

            this.initSound();

        }

        // 2d renderer
        this.renderer2d = new THREE.CSS2DRenderer();
        this.renderer2d.setSize(window.innerWidth, window.innerHeight);
        this.renderer2d.domElement.style.position = 'absolute';
        this.renderer2d.domElement.style.top = 0; // IMPORTANT FOR SCROLL
        // this.labelRenderer.domElement.style.border = "10px solid white";
        this.renderer2d.domElement.style.pointerEvents = "none";
        document.body.appendChild(this.renderer2d.domElement);

        // aiming & shooting - disabled only if set to FALSE
        if (localStorage.getItem('shooting') !== 'false') {
            this.shooting = new Shooting();
            this._camera.add(this.shooting.createHUD())
            this.players.initShooting(true);
        }
        console.log('shooting is ' + (this.shooting ? 'enabled' : 'disabled'));

        if (!this.simpleRendering) {
            // Deddy
            this.createSpace();

        }


    }

    createSpace() {
        // Add Sky
        const sky = new Sky();
        sky.scale.setScalar(1000);
        this.scene.add(sky);

        const sun = new THREE.Vector3();

        const effectController = {
            turbidity: 20,
            rayleigh: 0.122,
            mieCoefficient: 0.01,
            mieDirectionalG: 0.99996,
            elevation: 15,
            azimuth: 90,
            exposure: 100
        };

        const uniforms = sky.material.uniforms;
        uniforms['turbidity'].value = effectController.turbidity;
        uniforms['rayleigh'].value = effectController.rayleigh;
        uniforms['mieCoefficient'].value = effectController.mieCoefficient;
        uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

        const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
        const theta = THREE.MathUtils.degToRad(effectController.azimuth);

        sun.setFromSphericalCoords(1, phi, theta);

        uniforms['sunPosition'].value.copy(sun);

        this._renderer.toneMappingExposure = effectController.exposure;

        // stars

        let starVertices = [];

        const starDis = 1000;
        for (let i = 0; i < 1000; i++) {
            const star = new THREE.Vector3(
                Math.random() * starDis - starDis / 2,
                Math.random() * starDis - starDis / 2,
                Math.random() * starDis - starDis / 2
            );

            starVertices.push(star);

        }

        let starGeo = new THREE.BufferGeometry().setFromPoints(
            starVertices
        );

        let sprite = new THREE.TextureLoader().load('../static/img/star.png');

        let starMaterial = new THREE.PointsMaterial({
            opacity: 0.8,
            transparent: true,
            color: 0xaaaaaa,
            size: 0.3,
            map: sprite
        });

        let stars = new THREE.Points(starGeo, starMaterial);

        this.scene.add(stars);

        starVertices = [];

        for (let i = 0; i < 1000; i++) {
            const star = new THREE.Vector3(
                Math.random() * 60 - 30,
                Math.random() * 60 - 30,
                Math.random() * 60 - 30
            );

            starVertices.push(star);
        }

        starGeo = new THREE.BufferGeometry().setFromPoints(
            starVertices
        );

        starMaterial = new THREE.PointsMaterial({
            opacity: 0.5,
            transparent: true,
            color: 0xaaaaaa,
            size: 0.08,
            map: sprite
        });

        stars = new THREE.Points(starGeo, starMaterial);

        this.scene.add(stars);


        // lensflares
        const textureLoader = new THREE.TextureLoader();

        const textureFlare0 = textureLoader.load('../static/texture/lensflare/lensflare0_alpha.png');
        const textureFlare3 = textureLoader.load('../static/texture/lensflare/lensflare3.png');

        let light = new THREE.PointLight(0xFFFFFF, 1.5, 2000);
        light.color.setHSL(0, 0, 0.1);
        light.position.set(800, 250, 0);
        this.scene.add(light);

        const lensflare = new Lensflare();
        lensflare.addElement(new LensflareElement(textureFlare0, 700, 0, light.color));
        lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
        lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
        lensflare.addElement(new LensflareElement(textureFlare3, 120, 0.9));
        lensflare.addElement(new LensflareElement(textureFlare3, 70, 1));
        light.add(lensflare);


        const planetTexture = textureLoader.load('../static/texture/2k_jupiter.jpg');

        const planet = new THREE.Mesh(new THREE.SphereBufferGeometry(1000, 32, 32), new THREE.MeshStandardMaterial({
            map: planetTexture,
            fog: false
        }));

        planet.position.x = 2000;
        planet.position.y = 1400;
        planet.position.z = 2000;

        this.scene.add(planet);

        const moonTexture = textureLoader.load('../static/texture/2k_mercury.jpg');

        const moon = new THREE.Mesh(new THREE.SphereBufferGeometry(100, 32, 32), new THREE.MeshStandardMaterial({
            map: moonTexture,
            fog: false
        }));

        moon.position.x = 1000;
        moon.position.y = 900;
        moon.position.z = 550;

        this.scene.add(moon);

        this.scene.fog = new THREE.FogExp2(0x1c222d, 0.00145);

        const worldWidth = 300, worldDepth = 300;
        const data = this.generateGroundNormal(worldWidth, worldDepth);

        const groundGeometry = new THREE.PlaneGeometry(6750, 6750, worldWidth - 1, worldDepth - 1);
        groundGeometry.rotateX(-Math.PI / 10);

        const groundVertices = groundGeometry.attributes.position.array;

        for (let i = 0, j = 0, l = groundVertices.length; i < l; i++, j += 3) {

            groundVertices[j + 1] = data[i] * 2;

        }

        const groundTexture = textureLoader.load('../static/texture/2k_mars.jpg');
        groundTexture.wrapS = THREE.ClampToEdgeWrapping;
        groundTexture.wrapT = THREE.ClampToEdgeWrapping;

        const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({map: groundTexture}));
        // ground.position.x = -10;
        ground.position.y = -100;
        ground.rotation.z = 0.1;
        this.scene.add(ground);


        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0;
        bloomPass.strength = 0.5;
        bloomPass.radius = 0;

        this.composer.addPass(bloomPass);

    }

    //////////////////////////////////////////////////////////
    createBorderPad(divisions, zDir, zPosFactor, xDir, xPosFactor, yPos) {
        let grid = new THREE.GridHelper(SIZE / 2, divisions / 2, GREY, GREY);
        this.scene.add(grid);
        grid.position.z = SIZE * zPosFactor * zDir;
        grid.position.x -= SIZE * xPosFactor * xDir;
        grid.position.y = yPos;
    }

    createBorderPads(divisions, zDir, xDir, yPos) {

    }

    //////////////////////////////////////////////////////////
    createHoriz(divisions, color, zDir, yPos) {
        let zOffset = SIZE / 2 * zDir + zDir * 0.01;// little space to avoid overlap
        // create floor
        let grid = new THREE.GridHelper(SIZE * 2, divisions, color, color);

        this.scene.add(grid);
        grid.position.z = zOffset * 2;
        grid.position.y = yPos;

        const geometry = new THREE.BoxGeometry(SIZE * 2, 0.1, SIZE * 2);
        const material = new THREE.MeshBasicMaterial({opacity: 0.1, transparent: true, color: color});
        const cube = new THREE.Mesh(geometry, material);
        grid.add(cube);

        // create pads
        this.createBorderPads(divisions, zDir, 1, yPos);
        this.createBorderPads(divisions, zDir, -1, yPos);
    }

    //////////////////////////////////////////////////////////
    createBorders(color, zDir) {
        const divisions = 20;

        this.border.east = SIZE;
        this.border.west = -SIZE;

        // create floor
        this.border.floor = 0;
        this.createHoriz(divisions, color, zDir, this.border.floor);

        // create ceiling
        this.border.ceiling = SIZE;
        this.createHoriz(divisions, color, zDir, this.border.ceiling);

        this.border.north = -SIZE * 1.5;
        this.border.south = SIZE * 1.5;
    }

    //////////////////////////////////////////////////////////
    createGate(color, GATE_SIZE) {
        //const geometry = new THREE.TorusGeometry( GATE_SIZE, GATE_SIZE/3, 32, 16 );
        let geometry = new THREE.TorusGeometry(GATE_SIZE, GATE_SIZE / 3, 32, 8);
        // red gate
        // NOT WORKING WITH RAYCAST! let material = new THREE.LineBasicMaterial({color: color /*side: THREE.DoubleSide*/  });
        let material = new THREE.MeshStandardMaterial({color: color /*side: THREE.DoubleSide*/});
        let gate = new THREE.Mesh(geometry, material);

        // add internal sphere for gate pass calc
        geometry = new THREE.SphereGeometry(GATE_SIZE / 1.5, 16, 16);
        const sColor = color === RED2 ? 0xFF0000 : 0x0000FF;
        material = new THREE.MeshStandardMaterial({
            color: 0xFF00FF,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.name = 'gatePass';
        gate.add(sphere);

        return gate;
    }

    //////////////////////////////////////////////////////////
    initSound() {
        this.sound = new Sound(this._camera);
        // TODO: resume
        this.sound.add('gate.wav', this.redGate, true, SIZE);
        // delay sound so both gates wont sync souds
        setTimeout(() => this.sound.add('gate.wav', this.blueGate, true, SIZE), 500);

        //this.explode.initSound(this.sound);

        this.players.initSound(this.sound);
    }

    //////////////////////////////////////////////////////////
    // onFirst(){
    //   this.initSound();
    //   let sound = this.redGate.getObjectByName('sound_gate.wav');
    //   if(sound) sound.play();
    //   sound = this.blueGate.getObjectByName('sound_gate.wav');
    //   if(sound) sound.play();
    // }
    //////////////////////////////////////////////////////////
    createCamera() {
        this._camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

        // aim and dashboard
        // var cubeGeometry = new THREE.CircleGeometry( 0.2, 32);
        // var cubeMaterial = new THREE.MeshStandardMaterial({color: 0xffffff, side: THREE.DoubleSide, transparent: false, opacity: 0.5, depthTest: false});
        // var cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        // this._camera.add(cube);
        // cube.position.set( 0, 0, -30 );
        this.scene.add(this._camera); //TODO: resume

        // middle
        this._camera.position.y = SIZE / 2;

        // this.startLineZ = this._camera.position.z;
        // this.startLineY = this._camera.position.y;
    }

    //////////////////////////////////////////////////////////
    checkGatePass() {
        if (this.redGate.passSphere.containsPoint(this._camera.position)) return this.redGate;
        if (this.blueGate.passSphere.containsPoint(this._camera.position)) return this.blueGate;
        return null
    }

    //////////////////////////////////////////////////////////
    checkCrossBorders() {
        // X axis
        if (this._camera.position.x < this.border.west) return true;
        if (this._camera.position.x > this.border.east) return true;
        // Y axis
        if (this._camera.position.y < this.border.floor) return true;
        if (this._camera.position.y > this.border.ceiling) return true;
        // z axis
        if (this._camera.position.z < this.border.north) return true;
        if (this._camera.position.z > this.border.south) return true;

        return false;
    }

    ////////////////////////////////////////////////////////
    // AMI rename to also obstacles
    checkColissionGate() {
        this.raycaster.near = config.raycastNear;
        this.raycaster.far = config.raycastFar;

        // calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects([this.redGate, this.blueGate]);
        //const intersects = this.raycaster.intersectObject( this.blueGate );

        if (intersects && intersects.length) {
            //console.log('checkColissionGate',intersects.length, intersects[0].distance, `distance: ${config.colideDistance}`);
            // for(let i of intersects){
            console.log(intersects[0].distance);
            if (intersects[0].distance < config.colideDistance) {
                return true;
            }
        }
        return false;
    }

    //////////////////////////////////////////////////////////
    doExplode() {
        this.explode.create(this._camera.position.x, this._camera.position.y, this._camera.position.z, game.localState.isRed);
        // camera sound moved to HTMLs
        //let sound = this._camera.getObjectByName('sound_explode.wav');
        //if(sound) sound.play();
    }

    turnWarningEffect(on) {
        this.afterImagePass.enabled = on;
        // if(!this.effect1){
        //   this.effect1 = new THREE.ShaderPass( THREE.DotScreenShader );
        //   this.effect1.uniforms[ 'scale' ].value = 40;
        // }
        // if(!this.effect2){
        //   this.effect2 = new THREE.ShaderPass( THREE.RGBShiftShader );
        //   this.effect2.uniforms[ 'amount' ].value = 0.015;
        // }
        // if(on){
        //   this.composer.addPass( this.effect1 );
        //   this.composer.addPass( this.effect2 );
        // }else{
        //   this.composer.removePass( this.effect1 );
        //   this.composer.removePass( this.effect2 );

        // }
    }

    //////////////////////////////////////////////////////////
    // set this player's team
    setNick(nick) {
        this.players.setNick(nick);
    }

    //////////////////////////////////////////////////////////
    // set this player's team
    setTeamPos(isRed) {
        // no team - set center
        if (isRed == null) {
            this._camera.position.z = 0;
            this._camera.position.x = 0;
            this._camera.position.y = SIZE / 2;
            // not joined-
            this.players.gameJoined = false;
            return;
        }
        // set start line
        const myGate = isRed ? this.blueGate : this.redGate;
        this.startLineZ = myGate.position.z;
        const half = SIZE / 2;
        // 2 - 7
        this.startLineY = Math.floor(Math.random() * half) + half;
        // (-2) - 2
        this.startLineX = Math.floor(Math.random() * half) - half;

        // POS
        this._camera.position.x = this.startLineX;
        this._camera.position.y = this.startLineY;
        this._camera.position.z = this.startLineZ

        // Look at the other gate
        // this._camera.rotation.y = isRed? 0 : Math.PI //* (360 / 360);
        if (game.controls) {
            let target = isRed ? this.redGate : this.blueGate;
            if (target) {
                game.controls.lookAt(target.position);
            }//else{
            //   this._camera.rotation.y = isRed? 0 : Math.PI //* (360 / 360);
            // }
        }

        //this.startLineRot = this._camera.rotation.clone()

        if (this.shooting) {
            this.shooting.isRed = isRed;
        }
    }

    //////////////////////////////////////////////////////////
    // set other players teams
    setPlayerTeams(red, blue) {
        this.players.setTeams(red, blue);
    }

    //////////////////////////////////////////////////////////
    attachFlagToHolderOrGate(holderNick, flagIsRed) {
        // detach
        const flagName = flagIsRed ? 'red' : 'blue';
        const flag = this.flags.detach(flagName);
        if (holderNick) { // Add to holder
            console.log('attachFlagToHolder', flagName, holderNick);
            const holder = this.players.getPlayer(holderNick).obj;
            this.flags.attachTo(flagName, holder);
            //this.flags.setPosPlayer(flagName);
        } else { // return to gate
            const gateName = flagIsRed ? 'blue' : 'red';
            console.log('attachFlagToGate', flagName, 'gate=' + gateName);
            this.flags.moveToGate(flagName);
            this.scene.add(flag);
        }
    }

    //////////////////////////////////////////////////////////
    setFlagHolders(holdingFlag, localState, mngrState) {
        //console.log('setFlagHolders');
        let el = document.getElementById('flag-holder');
        el.style.display = holdingFlag ? 'block' : 'none';

        // Im the Holder
        if (holdingFlag) {
            let name = localState.isRed ? "blue" : "red";
            el.className = name;
            // attach correct flag to self/camera
            this.flags.attachTo(name, this._camera);

            //this.flags.setPosCamera(name);
        } else {
            this.attachFlagToHolderOrGate(mngrState.redHolder, true);
            this.attachFlagToHolderOrGate(mngrState.blueHolder, false);
        }
    }

    //////////////////////////////////////////////////////////
    return2Start(cb, controls, targetGate) {
        // target ts
        let dt = new Date();
        dt.setSeconds(dt.getSeconds() + config.return2startSec, 0);

        let denom = config.return2startSec * 1000;

        this.returnObj = {
            cb: cb,
            tsFinish: dt.getTime(),
            // delta pos
            xDiff: (this.startLineX - this._camera.position.x) / denom,
            yDiff: (this.startLineY - this._camera.position.y) / denom,
            zDiff: (this.startLineZ - this._camera.position.z) / denom,
            controls: controls,
            targetGate: targetGate,
            // delta rot
            xLook: (targetGate.position.x - this._camera.position.x) / denom,
            yLook: (targetGate.position.y - this._camera.position.y) / denom,
            zLook: (targetGate.position.z - this._camera.position.z) / denom,
            lookPos: this._camera.position.clone()
        };
    }

    //////////////////////////////////////////////////////////
    updateReturn2Start(delta) {
        if (Date.now() >= this.returnObj.tsFinish) {
            this._camera.position.x = this.startLineX;
            this._camera.position.y = this.startLineY;
            this._camera.position.z = this.startLineZ;
            //this._camera.rotation.copy(this.startLineRot);

            this.returnObj.cb();
            this.returnObj = null;
            return;
        }

        let returnObj = this.returnObj;
        this._camera.position.x += returnObj.xDiff * delta;
        this._camera.position.y += returnObj.yDiff * delta;
        this._camera.position.z += returnObj.zDiff * delta;

        // // shift looks pos towards gate
        returnObj.lookPos.x += returnObj.xLook * delta;
        returnObj.lookPos.y += returnObj.yLook * delta;
        returnObj.lookPos.z += returnObj.zLook * delta;

        // look at target
        returnObj.controls.lookAt(returnObj.lookPos);
    }

    //////////////////////////////////////////////////////////
    get camera() {
        return this._camera;
    }

    //////////////////////////////////////////////////////////
    get renderer() {
        return this._renderer;
    }

    //////////////////////////////////////////////////////////
    resetGateRotation() {
        this.redGate.rotation.y = 0;
        this.blueGate.rotation.y = 0;
    }

    //////////////////////////////////////////////////////////
    onresize(e) {
        // 3D
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
        // 2D
        this.renderer2d.setSize(window.innerWidth, window.innerHeight);
        // this.renderer2d.domElement.style.width = window.innerWidth;
        // this.renderer2d.domElement.style.height = window.innerHeight;
    }

    render(delta) {

        // rotate gates & flags in sync with all players
        if (game.mngrState?.startTs) {
            const diff = Date.now() - game.mngrState.startTs;

            const modMs = diff % this.msPerTurn;
            const angle = this.gateRad * modMs

            if (!this.disableGateRotation) {

                this.redGate.rotation.y = angle;
                this.blueGate.rotation.y = Math.PI * 2 - angle;

            }

            this.flags.update(this.gateRad);
        }

        // players
        this.players.update(delta);
        // explosions
        this.explode.beforeRender();

        // check collisions & shooting not during exploding or not moving
        if (!game.exploding && game.moving) {
            if (this.checkCrossBorders())
                return true;// exploding

            // set raycast
            this.raycaster.setFromCamera(new THREE.Vector3(), this.camera);

            if (this.checkColissionGate())
                return true; // exploding

            // shooting
            if (this.shooting) {
                this.shooting.update(this.raycaster, this.players);
            }
        }
        // return to start
        if (this.returnObj) {
            this.updateReturn2Start(delta);
        }

        // scene 3d 2d rendering
        //this._renderer.render(this.scene, this._camera);
        this.composer.render();

        this.renderer2d.render(this.scene, this._camera);

        return false; //not exploding
    }


    generateGroundNormal(width, height) {

        let seed = Math.PI / 4;
        window.Math.random = function () {

            const x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);

        };

        const size = width * height, data = new Uint8Array(size);
        const perlin = new ImprovedNoise(), z = Math.random();

        let quality = 0.3;

        for (let j = 0; j < 4; j++) {

            for (let i = 0; i < size; i++) {

                const x = i % width, y = ~~(i / width);
                data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);

            }

            quality *= 5;

        }

        return data;

    }


}
