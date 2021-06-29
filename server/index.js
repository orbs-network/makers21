const { Deepstream } = require('@deepstream/server')

const server = new Deepstream()

// start the server
server.start()


// Run Client on behalf of the server 
const { DeepstreamClient } = require('@deepstream/client')
const client = new DeepstreamClient('34.134.236.209:6020')
const GHOST_THRESHOLD = 10000;

var PlayerPositions = {}
var playerGhosts = {};


client.login({}, (success, data) => {
    client.event.subscribe('player', (data)=>{
        //console.log('data',data)
        let player = PlayerPositions[data.id];
        // if player hasnt moved dont update positions
        if( player?.pos?.x == data?.pos.x && player?.pos?.y == data?.pos?.y) {
            return;
        }
        PlayerPositions[data.id] = { pos: data.pos, ts: Date.now() };
    }); 

    

    client.event.subscribe('playerGhost', (data)=> {
        playerGhosts[data.id] = Date.now();
        console.log('======== PlayerGhost ========', data);
    });

    client.event.subscribe('heartbeat', (data)=>{
        console.log('heartbeat', data);
     }); 

     client.event.subscribe('tick', (data)=>{
        console.log('tick', data);
     }); 
})


setInterval( ()=> { 
    //console.log(PlayerPositions);
    for(var key in PlayerPositions) {
        let it = PlayerPositions[key];
        if(Date.now() - it.ts > GHOST_THRESHOLD ) {
            client.event.emit('playerGhost', { lastUpdate:it.ts, id:key });
        }
    }

}, 5000);