const THREEx = window.THREEx || {};
window.THREEx = THREEx;

THREEx.SpaceShips = {};

THREEx.SpaceShips.baseUrl = 'assets/';

THREEx.SpaceShips._loadObjMtl = function (loaderPath, objBasename, mtlBasename, onLoad, onProgress, onError) {
	const mtlLoader = new THREE.MTLLoader();
	mtlLoader.setPath(loaderPath);
	mtlLoader.load(mtlBasename, function (materials) {
		materials.preload();

		const objLoader = new THREE.OBJLoader();
		objLoader.setMaterials(materials);
		objLoader.setPath(loaderPath);
		objLoader.load(
			objBasename,
			function (object3d) {
				onLoad && onLoad(object3d);
			},
			onProgress,
			onError
		);
	});
};

THREEx.SpaceShips.loadSpaceFighter01 = function (onLoad, onProgress, onError) {
	const loaderPath = THREEx.SpaceShips.baseUrl + 'models/SpaceFighter01/';
	THREEx.SpaceShips._loadObjMtl(
		loaderPath,
		'SpaceFighter01.obj',
		'SpaceFighter01.mtl',
		function (object3d) {
			// set the scale
			object3d.scale.multiplyScalar(1 / 300);
			// change emissive color of all object3d material - they are too dark
			object3d.children.forEach(function (object3d) {
				object3d.material.forEach(function (material) {
					material.emissive.set('#050505');
				});
			});
			// notify the callback
			onLoad && onLoad(object3d);
		},
		onProgress,
		onError
	);
};

THREEx.SpaceShips.loadSpaceFighter02 = function (onLoad, onProgress, onError) {
	const loaderPath = THREEx.SpaceShips.baseUrl + 'models/SpaceFighter02/';
	THREEx.SpaceShips._loadObjMtl(
		loaderPath,
		'SpaceFighter02.obj',
		'SpaceFighter02.mtl',
		function (object3d) {
			// set the scale
			object3d.scale.multiplyScalar(1 / 200);
			// change emissive color of all object3d material - they are too dark
			object3d.children.forEach(function (object3d) {
				if (object3d.material) {
					object3d.material.forEach(function (material) {
						material.emissive.set('#111');
					});
				} else {
					object3d.material.emissive.set('#111');
				}
			});
			// notify the callback
			onLoad && onLoad(object3d);
		},
		onProgress,
		onError
	);
};

THREEx.SpaceShips.loadSpaceFighter03 = function (onLoad, onProgress, onError) {
	const loaderPath = THREEx.SpaceShips.baseUrl + 'models/SpaceFighter03/';
	THREEx.SpaceShips._loadObjMtl(
		loaderPath,
		'SpaceFighter03.obj',
		'SpaceFighter03.mtl',
		function (object3d) {
			// set the scale
			object3d.scale.multiplyScalar(1 / 10);
			// change emissive color of all object3d material - they are too dark
			object3d.children.forEach(function (object3d) {
				if (object3d.material) {
					object3d.material.forEach(function (material) {
						material.emissive.set('#111');
					});
				} else {
					object3d.material.emissive.set('#111');
				}
			});
			// notify the callback
			onLoad && onLoad(object3d);
		},
		onProgress,
		onError
	);
};

THREEx.SpaceShips.loadShuttle01 = function (onLoad, onProgress, onError) {
	const loaderPath = THREEx.SpaceShips.baseUrl + 'models/Shuttle01/';
	THREEx.SpaceShips._loadObjMtl(
		loaderPath,
		'Shuttle01.obj',
		'Shuttle01.mtl',
		function (object3d) {
			// set the scale
			object3d.scale.multiplyScalar(1 / 400);
			// change emissive color of all object3d material - they are too dark
			object3d.children.forEach(function (object3d) {
				if (object3d.material) {
					object3d.material.forEach(function (material) {
						material.emissive.set('#111');
					});
				} else {
					object3d.material.emissive.set('#111');
				}
			});
			// notify the callback
			onLoad && onLoad(object3d);
		},
		onProgress,
		onError
	);
};

THREEx.SpaceShips.loadShuttle02 = function (onLoad, onProgress, onError) {
	const loaderPath = THREEx.SpaceShips.baseUrl + 'models/Shuttle02/';
	THREEx.SpaceShips._loadObjMtl(
		loaderPath,
		'Shuttle02.obj',
		'Shuttle02.mtl',
		function (object3d) {
			// set the scale
			object3d.scale.multiplyScalar(1 / 400);
			// change emissive color of all object3d material - they are too dark
			object3d.children.forEach(function (object3d) {
				if (object3d.material) {
					object3d.material.forEach(function (material) {
						material.emissive.set('#111');
					});
				} else {
					object3d.material.emissive.set('#111');
				}
			});
			// notify the callback
			onLoad && onLoad(object3d);
		},
		onProgress,
		onError
	);
};

//////////////////////////////////////////////////////////////////////////////////
//		comment								//
//////////////////////////////////////////////////////////////////////////////////

THREEx.SpaceShips.Shoot = function () {
	// your code goes here
	const canvas = generateShootCanvas();
	const texture = new THREE.Texture(canvas);
	texture.needsUpdate = true;


	// do the material
	const material = new THREE.MeshBasicMaterial({
		color: 0xffaacc,
		map: texture,
		side: THREE.DoubleSide,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		transparent: true,
	});

	const container = new THREE.Object3D();
	container.rotateY(Math.PI / 2);
	container.scale.multiplyScalar(1 / 2);
	const nPlanes = 4;
	for (let i = 0; i < nPlanes; i++) {
		const geometry = new THREE.PlaneGeometry(1, 1);
		const mesh = new THREE.Mesh(geometry, material);
		mesh.material = material;
		mesh.rotateX((i * Math.PI) / nPlanes);
		container.add(mesh);
	}

	return container;

	function generateShootCanvas() {
		// init canvas
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		canvas.width = 16;
		canvas.height = 64;
		// set gradient
		const gradient = context.createRadialGradient(
			canvas.width / 2,
			canvas.height / 2,
			0,
			canvas.width / 2,
			canvas.height / 2,
			canvas.width / 2
		);
		gradient.addColorStop(0, 'rgba(255,255,255,1)');
		gradient.addColorStop(0.5, 'rgba(192,192,192,1)');
		gradient.addColorStop(0.8, 'rgba(128,128,128,0.7)');
		gradient.addColorStop(1, 'rgba(0,0,0,0)');

		// fill the rectangle
		context.fillStyle = gradient;
		context.fillRect(0, 0, canvas.width, canvas.height);
		// return the just built canvas
		return canvas;
	}
};

/**
 * create a detonation effect.
 */
THREEx.SpaceShips.Detonation = function () {
	const baseUrl = THREEx.SpaceShips.baseUrl;
	const url = baseUrl + 'images/lensflare0_alpha.png';
	// Use TextureLoader instead of deprecated ImageUtils.loadTexture
	const textureLoader = new THREE.TextureLoader();
	const texture = textureLoader.load(url);
	// do the material
	const geometry = new THREE.PlaneGeometry(1, 1);
	const material = new THREE.MeshBasicMaterial({
		color: 0x00ffff,
		map: texture,
		side: THREE.DoubleSide,
		blending: THREE.AdditiveBlending,
		opacity: 2,
		depthWrite: false,
		transparent: true,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.scale.multiplyScalar(0.75);
	return mesh;
};
