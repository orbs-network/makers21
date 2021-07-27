class Mngr /*extends THREE.EventDispatcher*/ {
  //////////////////////////////////////////////////////////
  constructor(){
    this.state = {
      started:false, // playing now
      ready:false, // enough players are connected
      red:[],
      blue:[],
      clients:new Set(),
      redFlag:"blueGate",
      blueFlag:"redGate",
    };
    localStorage.setItem('state', this.state);
  }
  //////////////////////////////////////////////////////////
  start(){
    //setFields
    this.updateUI();
    // rpcServer.
    deepStream.client.rpc.provide('client', this.onClient.bind(this));
  }
  //////////////////////////////////////////////////////////
  onClient(data, res){
    switch(data.type){
      case 'online':
        res.send({status:'ok',state:this.state});
        break;
      case 'join':
        this.onJoin(data, res);
        break;
      case 'leave':
        this.onLeave(data, res);
        break;
    }

  }
  //////////////////////////////////////////////////////////
  tellState(){
    this.updateUI();
    deepStream.sendEvent('mngr',{
      type:"state",
      state:this.state
    });
  }
  //////////////////////////////////////////////////////////
  onOnline(data){
    console.log("onOnline",data);
    this.state.clients.add(data.id);
    this.tellState();
  }
  //////////////////////////////////////////////////////////
  saveState(){
    localStorage.setItem("state", JSON.stringify(this.state));
  }
  //////////////////////////////////////////////////////////
  loadState(){
    const jsn = localStorage.getItem("state");
    let state ;
    try{
      state = JSON.parse(jsn);
    }catch(e){
      console.error(e);
      this.state = {};
      return;
    }
    this.state = state;
  }
  //////////////////////////////////////////////////////////
  onJoin(data, res){
    console.log("onJoin",data);
    // add to team
    let add = data.isRed? this.state.red : this.state.blue;
    let rmv = data.isRed? this.state.blue : this.state.red;
    // add nick
    if(!add.includes(data.nick)){
      add.push(data.nick);
      res.send('ok');
    }// else reject nickname
    else{
      res.send(`nickname [${data.nick}] is in use, please try another`);
      //deepStream.se
      return;
    }

    const index = rmv.indexOf(data.nick);
    if(index > -1){
      rmv.splice(index, 1);
    }
    this.tellState();
    this.saveState();
  }
  //////////////////////////////////////////////////////////
  onLeave(data, res){
    console.log("onLeave",data);
    // add to team
    let rmv = data.isRed? this.state.red : this.state.blue;
    // add nick
    const index = rmv.indexOf(data.nick);
    if(index > -1){
      rmv.splice(index, 1);
    }
    res.send('ok');
    this.tellState();
    this.saveState();
  }
  //////////////////////////////////////////////////////////
  updateUI(){
    // game started
    $('#started').text(`status: ${this.state.started? 'true':'pending'}`);
    var state = this.state;
    // red & blue teams
    let $red = $('#red');
    $red.empty();
    $.each(state.red, function(i){
      var li = $('<li/>').appendTo($red);
      li.text(state.red[i]);
    });
    // blue
    let $blue = $('#blue');
    $blue.empty();
    $.each(state.blue, function(i){
      var li = $('<li/>').appendTo($blue);
      li.text(state.blue[i]);
    });

    // clients
    // clients connected
    const $clients = $('#clients');
    const arr = Array.from(this.state.clients);
    $clients.empty();
    $.each(arr, function(i){
        var li = $('<li/>').appendTo($clients);
        li.text(arr[i]);
    });
  }
}

$(document).ready(function(){
  let mngr = new Mngr();
  mngr.start();
})