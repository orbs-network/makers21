class Obstacles  {
  //////////////////////////////////////////////////////////
  constructor(world){
		this.dict ={};
		this.world = world;
	  	this.grid = []

  }

  generateRandomObstacles() {

  	this.createRandomGrid()

	for (let i=0; i < config.numObstacles; i++) {
		this.createObstacle(this.world.createModelGeometry(), this.world.scene, `obstacle${i}`, this.grid[i])
	}

  }
  range(size, startAt = 0) {
	return [...Array(size).keys()].map(i => i + startAt);
  }

  createRandomGrid() {

   	let a0 = this.range(config.ObstaclesGridDivider, -Math.floor(config.ObstaclesGridDivider/2))
    let a1 = this.range(config.ObstaclesGridDivider, 0)
    let a2 = this.range(config.ObstaclesGridDivider, -Math.floor(config.ObstaclesGridDivider/2))

    a0 = a0.sort(() => (Math.random() > .5) ? 1 : -1)
    a1 = a1.sort(() => (Math.random() > .5) ? 1 : -1)
    a2 = a2.sort(() => (Math.random() > .5) ? 1 : -1)

	const ref = config.size / config.ObstaclesGridDivider

	for (let i = 0; i < config.ObstaclesGridDivider; i++) {
		this.grid.push([2 * ref * a0[i], ref * a1[i], 2 * ref * a2[i]])
	}

  }
  //////////////////////////////////////////////////////////
  createObstacle(object, scene, name, pos) {

		this.dict[name] = object;

		this.addToGrid(name, pos);
		scene.add( object );

  }

	getRandomInt(max) {
		return Math.floor(Math.random() * Math.abs(max));
	}

	//////////////////////////////////////////////////////////
	addToGrid(name, pos) {
		const obj = this.dict[name];

		obj.position.x = pos[0];
		obj.position.y = pos[1];
		obj.position.z = pos[2];
	}
}
