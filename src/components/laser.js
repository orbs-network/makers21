const THREEx = window.THREEx || {};
window.THREEx = THREEx;

THREEx.LaserBeam = function () {
	const object3d = new THREE.Object3D();
	this.object3d = object3d;
	// generate the texture
	const canvas = generateLaserBodyCanvas();
	const texture = new THREE.Texture(canvas);
	texture.needsUpdate = true;
	// do the material
	const material = new THREE.MeshBasicMaterial({
		map: texture,
		blending: THREE.AdditiveBlending,
		color: 0x4444aa,
		side: THREE.DoubleSide,
		depthWrite: false,
		transparent: true,
	});
	const geometry = new THREE.PlaneGeometry(1, 0.1);
	const nPlanes = 16;
	for (let i = 0; i < nPlanes; i++) {
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.x = 1 / 2;
		mesh.rotation.x = (i / nPlanes) * Math.PI;
		object3d.add(mesh);
	}
	return;

	function generateLaserBodyCanvas() {
		// init canvas
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		canvas.width = 1;
		canvas.height = 64;
		// set gradient
		const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
		gradient.addColorStop(0, 'rgba(  0,  0,  0,0.1)');
		gradient.addColorStop(0.1, 'rgba(160,160,160,0.3)');
		gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
		gradient.addColorStop(0.9, 'rgba(160,160,160,0.3)');
		gradient.addColorStop(1.0, 'rgba(  0,  0,  0,0.1)');
		// fill the rectangle
		context.fillStyle = gradient;
		context.fillRect(0, 0, canvas.width, canvas.height);
		// return the just built canvas
		return canvas;
	}
};
