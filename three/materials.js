materials= {
	redPhong: new THREE.MeshPhongMaterial({
		color: 0xFF0000,    // red (can also use a CSS color string here)
		flatShading: true,
		side: THREE.DoubleSide
	}),
	bluePhong:new THREE.MeshPhongMaterial({
		color: 0x0000FF,    // red (can also use a CSS color string here)
		flatShading: true,
		side: THREE.DoubleSide
	}),
	redExplode: new THREE.PointsMaterial( {color: 0xFF0000, size: config.explodePartSize}),
	blueExplode: new THREE.PointsMaterial({color: 0x0000FF, size: config.explodePartSize})
}