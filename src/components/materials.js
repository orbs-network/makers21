window.materials = {
    redPhong: new THREE.MeshPhongMaterial({
        color: 0xFF0000,
        flatShading: true,
        side: THREE.DoubleSide
    }),
    bluePhong: new THREE.MeshPhongMaterial({
        color: 0x0000FF,
        flatShading: true,
        side: THREE.DoubleSide
    }),
    redExplode: new THREE.PointsMaterial({
        transparent: true,
        size: config.explodePartSize
    }),
    blueExplode: new THREE.PointsMaterial({
        transparent: true,
        size: config.explodePartSize
    })
};
