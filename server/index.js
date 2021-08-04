console.log(`-====================-`)

const { Deepstream } = require('@deepstream/server')
const server = new Deepstream()


const { DeepstreamClient } = require('@deepstream/client')
const client = new DeepstreamClient('localhost:6020')
const { GameManager } = require('./game-manager');

var PlayerPositions = {}
var playerGhosts = {};


server.start();
client.login(null , ()=>{

  console.log(`-==================== login ==================-`);
})



    let gameManager = new GameManager(client);


    client.event.subscribe('player', (data)=>{
        //console.log('data',data)
        let player = PlayerPositions[data.id];
        // if player hasnt moved dont update positions
        if( player?.pos?.x == data?.pos.x && player?.pos?.y == data?.pos?.y) {
            return;
        }
        PlayerPositions[data.id] = { pos: data.pos, ts: Date.now() };
    });



    client.event.subscribe('heartbeat', (data)=>{
        console.log('====== heartbeat ========= ', data);
     });




