import {
    Vector3,
    MeshPhongMaterial,
    Mesh
} from 'three'

import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader";
import Physics from './physics'
import StateManager from './stateManager'

let v3 = new Vector3(0, 0, 0);

//////////////////////////////////////////////////////////
class Player {
    //////////////////////////////////////////////////////////
    constructor(obj, name) {
        this.obj = obj;
        this.moving = false;
        this.name = name
        this._initLabel(name);
    }

    //////////////////////////////////////////////////////////
    moveForward() {
        if (this.moving) {
            this.obj.getWorldDirection(v3);
            const direction = v3.multiplyScalar(config.speed);
            this.obj.position.add(direction);
        }
    }

    //////////////////////////////////////////////////////////
    onPos(data) {
        this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
        //this.rotation.set(data.rx, data.ry, data.rz);
        this.obj.lookAt(data.dir.x * 100, data.dir.y * 100, data.dir.z * 100);
        //this.moveForward();
    }

    //////////////////////////////////////////////////////////
    onStart(data) {
        this.moving = data.moving;
        this.obj.position.set(data.pos.x, data.pos.y, data.pos.z);
    }

    _initLabel(name) {
        const playerLabelDiv = document.createElement('div');
        playerLabelDiv.className = 'label';
        playerLabelDiv.textContent = name || "who dis?";
        playerLabelDiv.style.marginTop = '2em';
        playerLabelDiv.style.color = 'white';
        playerLabelDiv.style.fontFamily = "monospace";
        const playerLabelObj = new window.CSS2DObject(playerLabelDiv);
        playerLabelObj.position.set(0, 0, 0);
        this.obj.add(playerLabelObj);
    }
}

export default class Players {
    //////////////////////////////////////////////////////////
    constructor(game) {
        this.playersDict = {};
        this.game = game;
        this.loader = new OBJLoader();
        //this.redMatter = new THREE.MeshBasicMaterial({color: 0xFF00FF});         // red
        const material = new MeshPhongMaterial();
        //material.color.setHSL(0, 1, .5);  // red
        material.color.setRGB(.3, .8, .5);
        material.flatShading = false;
        this.matter = material;
        this.createDummy(() => {
            window.deepStream.subscribe("player", this.onEvent.bind(this));
        });


        //super();

        // this.moving = false;
        // this.first = true;
        // this.sound = new Sound();
        // //this.steering = new Steering();
    }

    //////////////////////////////////////////////////////////
    onEvent(data) {
        const p = this.getPlayer(data.id);
        if (!p) {
            console.error(`Player ${data.id} not found`);
            return;
        }
        switch (data.type) {
            case "pos":
                p.onPos(data);
                break;
            case "start":
                p.onStart(data);
                break;
        }

    }

    //////////////////////////////////////////////////////////
    update() {

        for (let name in this.playersDict) {

            const player = this.playersDict[name]

            player.moveForward()

            const collision = Physics.isIntersecting(
                World.player,
                player.obj
            )

            if (collision) {

                StateManager.collisionWithPlayer(
                    player
                )

            }

        }

    }

    //////////////////////////////////////////////////////////
    createNew(name) {
        if (!this.dummy) {
            return null;
        }
        const p = this.dummy.clone();
        p.name = name;

        //p.position.y = 2;
        //p.position.x  = 2;

        this.game.scene.add(p);
        const s = 2;
        p.scale.set(s, s, s);
        p.getWorldDirection(v3);
        // p.rotateX( 0.3);
        // p.rotateY( 0.1);
        // p.rotateZ( 0.8);
        p.castShadow = true;
        //p.updateWorldMatrix()
        //p.lookAt(game.redGate.position);
        //p.rotateOnWorldAxis(new THREE.Vector3(1,0,0),  10313.2);

        p.visible = true;

        const newPlayer = new Player(p, name);
        this.playersDict[name] = newPlayer;
        console.log('create player', name);
        this.game.sound.add('airplane-fly-by.wav', p);

        return newPlayer;
    }

    //////////////////////////////////////////////////////////
    createDummy(callback) {
        let matter = this.matter;
        this.loader.load(
            // resource URL
            //'model/old/11804_Airplane_v2_l2.obj',
            './static/model/paper/airplane.obj',
            // called when resource is loaded
            function (mesh) {
                mesh.traverse(function (child) {
                    if (child instanceof Mesh) {
                        //console.log(child.material);
                        //var m = child.material;
                        //console.log('1', JSON.stringify(m));
                        // child.material = new THREE.MeshPhongMaterial({
                        //   color: 0xFF0000,    // red (can also use a CSS color string here)
                        //   flatShading: true,
                        // });
                        child.material = matter;
                        //console.log(child);
                        //child.material.map = texture;
                        //child.material.normalMap = normal;
                    }
                });
                //mesh.position.set(6, 1, 0);
                //mesh.scale.set( new THREE.Vector3( 3, 3, 3 ));
                // mesh.rotation.z = Math.PI / 2;

                const playerDummy = Factory.physics.generateBoundingBox(
                    0.1, 0.1, 0.1
                )

                playerDummy.add(mesh)

                playerDummy.name = "dummy";
                playerDummy.visible = false;

                this.dummy = playerDummy;

                callback(playerDummy);

            }.bind(this),
            // called when loading is in progresses
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // called when loading has errors
            function (error) {
                console.log('An error happened', error);
            }
        );

    }

    //////////////////////////////////////////////////////////
    getPlayer(name) {
        const p = this.playersDict[name];
        if (p) {
            return p;
        }
        return this.createNew(name);
    }
}

window.Players = Players;