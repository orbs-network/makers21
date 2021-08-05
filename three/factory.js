const hPi = 0.5 * Math.PI;

window.factory = {
  firstPerson: {
    createHUD: () => {
      const hud = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        hud.add(new THREE.Mesh(new THREE.RingGeometry(0.048, 0.05, 128, 1, hPi * i + 0.2, hPi - 0.4), new THREE.LineBasicMaterial({color: `#60eaff`, transparent:true, opacity:0.5})))
      }
      hud.position.set( 0, 0, -1 );
      return hud;
    },
    createPlayerBoundingBox: (obj) => {
      return new THREE.BoxHelper(obj)
    }
  }
}
