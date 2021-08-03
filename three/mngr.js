class Mngr /*extends THREE.EventDispatcher*/ {
  //////////////////////////////////////////////////////////
  constructor(){
    this.resetState();
    localStorage.setItem('state', this.state);
  }
  //////////////////////////////////////////////////////////
  resetState(){
    this.state = {
      started:false, // playing now
      ready:false, // enough players are connected
      red:[],
      blue:[],
      clients:new Set(),
      redHolder:null,
      blueHolder:null,
      winnerNick:null,
      winnerIsRed:false
    };
  }
  //////////////////////////////////////////////////////////
  reset(){
    this.resetState();
    this.state.needReset = true;
    this.tellState();
    this.state.needReset = false;
    this.saveState();
  }
  //////////////////////////////////////////////////////////
  init(){
    $('#reset').click(this.reset.bind(this));
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
      case 'start':
        this.onStart(data, res);
        break;
      case 'gatePass':
        this.onGatePass(data, res);
        break;
      case 'flagDrop':
        this.onFlagDrop(data, res);
        break;
      case 'reset':
        this.reset();
        res.send('ok');
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
  onStart(data, res){
    if(this.state.started){
      res.send('Sorry, game already started!');
      return;
    }
    res.send('ok');

    let dt = new Date();
    dt.setSeconds( dt.getSeconds() + 3, 0 );
    console.log('game start time:',dt.toISOString());

    this.state.started = true;
    this.state.startedBy = data.nick;
    this.state.startTs = dt.getTime();
    this.state.winnerNick = null;
    this.state.winnerIsRed =false;
    this.tellState();
    this.saveState();

    // UPDATE VIA STATE
    // deepStream.sendEvent('mngr',{
    //   type:"startGame",
    //   ts:dt.getTime()
    // });
  }
  //////////////////////////////////////////////////////////
  // onOnline(data){
  //   console.log("onOnline",data);
  //   this.state.clients.add(data.id);
  //   this.tellState();
  // }
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
  setReady(){
    // if team size is equal on both size and > 0
    this.state.ready = this.state.red.length > 0 && (this.state.red.length == this.state.blue.length);
  }
  //////////////////////////////////////////////////////////
  onJoin(data, res){
    console.log("onJoin",data);
    // game already started
    if(this.state.started){
      return res.send('cant join, game already started');
    }
    // add to team
    let add = data.isRed? this.state.red : this.state.blue;
    let rmv = data.isRed? this.state.blue : this.state.red;
    // add nick
    if(!add.includes(data.nick)){
      add.push(data.nick);
    }// else reject nickname
    else{
      res.send(`nickname [${data.nick}] is in use, please try another`);
      return;
    }
    // remove
    const index = rmv.indexOf(data.nick);
    if(index > -1){
      rmv.splice(index, 1);
    }
    res.send('ok');
    this.setReady();
    this.tellState();
    this.saveState();
  }
  //////////////////////////////////////////////////////////
  onLeave(data, res){
    console.log("onLeave",data);
    // game already started
    if(this.state.started){
      return res.send('cant leave, game already started');
    }
    // add to team
    let rmv = data.isRed? this.state.red : this.state.blue;
    // add nick
    const index = rmv.indexOf(data.nick);
    if(index > -1){
      rmv.splice(index, 1);
    }
    res.send('ok');
    this.setReady();
    this.tellState();
    this.saveState();
  }
  //////////////////////////////////////////////////////////
  setFlagHolder(flagHolder, nick, res){
    this.state[flagHolder] = nick;
    this.updateUI();
    res.send('ok');
    // update everyone via state
    this.tellState();
    this.saveState();
  }
  //////////////////////////////////////////////////////////
  onGatePass(data, res){
    // win
    if(data.winGate){
      this.state.winnerNick = data.nick;
      this.state.winnerIsRed = (data.isRed == true);
      console.log('winnerNick!',this.state.winnerNick);
      console.log('winnerIsRed!',this.state.winnerIsRed);
      res.send('ok');
      this.tellState();
      this.saveState();
      return;
    }

    const flagHolder = data.isRed? 'blueHolder':'redHolder';
    // flag is captured
    if(!this.state[flagHolder]){
      this.setFlagHolder(flagHolder, data.nick, res);
    }else{
      res.send(`${this.state[flagHolder]} has already captured the flag`);
    }
  }
  //////////////////////////////////////////////////////////
  onFlagDrop(data, res){
    const flagHolder = data.isRed? 'blueHolder':'redHolder';
    // flag is dropped - assset dropper is indeed the holder
    if(this.state[flagHolder] == data.nick){
      this.setFlagHolder(flagHolder, null, res);
    }else{
      res.send(`${this.state[flagHolder]} the flag is not held by [${data.nick}] to drop`);
    }
  }
  //////////////////////////////////////////////////////////
  updateUI(){
    var state = this.state;
    // game started
    $('#started').text(`started: ${state.started? 'true':'pending'}`);
    $('#ready').text(`ready: ${state.ready? 'yes':'team size not equal or zero'}`);
    $('#winnerNick').text(this.state.winnerNick);
    $('#winnerIsRed').text(this.state.winnerIsRed);

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

    //flags
    $('#redHolder').text(this.state.redHolder || 'NONE');
    $('#blueHolder').text(this.state.blueHolder || 'NONE');

    // clients connected
    const $clients = $('#clients');
    const arr = Array.from(this.state.clients);
    $clients.empty();
    $.each(arr, function(i){
        var li = $('<li/>').appendTo($clients);
        li.text(arr[i]);
    });

    // reset
    if(this.state.started){
      $('#reset').show();
    }else{
      $('#reset').hide();
    }

  }
}

$(document).ready(function(){
  let mngr = new Mngr();
  mngr.init();
})