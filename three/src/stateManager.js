import FX from './fx'
import HUD from './hud'
import deepstream from "./deepstream";

const state = {}

const resetState = () => {

    state.health = 100
    state.score = 0
    state.lifes = 5

}

const gameOver = () => {

    // todo: reset game

}

const initNewGame = () => {

    // todo: reset player position

    this.state.health = 100

}

const death = () => {

    state.lifes--

    FX.explode()

    HUD.update()

    if (state.lifes >= 0) {

        initNewGame()

    } else {

        gameOver()

    }

}

export default {

    startGame() {

        initNewGame()

    },
    crash: () => {

        console.log('collision with ground')

        death()

        deepstream.sendEvent('playerCollision', {
            with: '__ground__'
        });

    },
    collisionWithPlayer: (player) => {

        console.log('collision with player: ' + player.name)

        death()

        deepstream.sendEvent('playerCollision', {
            with: player
        });

    },

    score: () => {

        this.state.score++

        HUD.update()

    },

    hit: () => {

        this.state.health -= 10

        if (this.state.health <= 0) {

            death()

        }

    }

}


