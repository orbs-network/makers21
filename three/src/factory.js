import {BoxGeometry, Mesh, MeshLambertMaterial} from "three";
import {development} from "./global";

export default {

    physics: {

        generateBoundingBox: (width, height, depth) => {

            const geometry = new BoxGeometry(width, height, depth)

            const material = new MeshLambertMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: development ? 0.2 : 0
            })

            return new Mesh(geometry, material)

        }

    }

}