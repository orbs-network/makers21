const Factory = {

    physics: {

        generateBoundingBox: (width, height, depth) => {

            const geometry = new THREE.BoxGeometry(width, height, depth)

            const material = new THREE.MeshLambertMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: development ? 0.2 : 0
            })

            return new THREE.Mesh(geometry, material)

        }

    }

}