const { DeepstreamClient } = window.DeepstreamClient
const client = new DeepstreamClient('10.11.11.66:6020')
client.login()
var uuid = client.getUid();


client.event.subscribe('tick', (data)=> {
    console.log(`tick ${data}`);
})

client.on('error', ( error, event, topic ) => {
    console.log(error, event, topic);
})

client.on('connectionStateChanged', connectionState => {
    // will be called with 'OFFLINE' once the connection is successfully paused.
})

function sendPos(pos, direction) {
    let dir = { rx: direction.x, ry: direction.y, rz: direction.z}
    let cords = Object.assign({p: uuid, ts: Date.now()}, pos, dir);
    client.event.emit('player.move', cords);
}


client.event.subscribe('heartbeat', data => {
    console.log(data);
})


client.event.subscribe('player.move', data => {
    if(data.p == uuid) {
        return;
    }

    // if(!other){
    //   other = document.getElementById("player");
    // }
    let other = Game.getPlayer(data.p);

    other.object3D.rotation.x = data.rx;
    other.object3D.rotation.y = data.ry;
    other.object3D.rotation.z = data.rz;

    other.object3D.position.x = data.x;
    other.object3D.position.y = data.y;
    other.object3D.position.z = data.z;
    
    console.log(`${data.p}> player.move |${data.x}|${data.y}|${data.z}|${data.rx}|${data.ry}|${data.rz}`);
    //console.log(data);
})


function throttle(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
        previous = options.leading === false ? 0 : Date.now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
    };
    return function() {
        var now = Date.now();
        if (!previous && options.leading === false) previous = now;
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = func.apply(context, args);
            if (!timeout) context = args = null;
        } else if (!timeout && options.trailing !== false) {
            timeout = setTimeout(later, remaining);
        }
        return result;
    };
};

setInterval(()=> {
    client.event.emit('heartbeat', uuid);
}, 5000);


window.networkLayer = {
    sendPos: throttle(sendPos,200)
}

