const hPi = 0.5 * Math.PI;

window.factory = {
  firstPerson: {
    createHUD: () => {
      const hud = new THREE.Group();

      for (let i = 0; i < 4; i++) {
        hud.add(new THREE.Mesh(new THREE.RingGeometry(0.048, 0.05, 128, 1, hPi * i + 0.2, hPi - 0.4), new THREE.LineBasicMaterial({color: `#60eaff`, transparent:true, opacity:0.5})))
      }
      // const object2 = new THREE.Mesh( new THREE.RingGeometry(0.045, 0.05, 128, 1, hPi, hPi),  new THREE.LineBasicMaterial( { color: 0xffff00 } ) );
      // const object3 = new THREE.Mesh( new THREE.RingGeometry(0.045, 0.05, 128, 1, hPi*2, hPi),  new THREE.LineBasicMaterial( { color: 0xffff00 } ) );
      // const object4 = new THREE.Mesh( new THREE.RingGeometry(0.045, 0.05, 128, 1, hPi*3, hPi),  new THREE.LineBasicMaterial( { color: 0xffff00 } ) );
      //
      // hud.add(object2)
      // hud.add(object3)
      // hud.add(object4)

      hud.position.set( 0, 0, -1 );
      return hud;
    }
  }
}
