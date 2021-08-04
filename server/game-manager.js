class GameManager /*extends THREE.EventDispatcher*/ {
    //////////////////////////////////////////////////////////
    constructor(deepStream){
      this.client = deepStream;
      this.resetState();
      this.init();

      //this.client.event.subscribe('managerState', state => {this.state = state});
    }
    syncState() {
    //  console.log('================================   syncState ==================================== ')
        //this.client.event.emit('managerState', this.state);
     //   this.state.type = 'state';
       // this.client.event.emit('mngr', this.state);
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
      //$('#reset').click(this.reset.bind(this));
      //setFields

      this.client.event.subscribe('player', (data)=>{
        console.log('player ', data);
      })

      this.client.event.subscribe('mngr-ui', (data)=>{
        this.tellState();
      });

      // rpcServer.
      this.client.rpc.provide('client', this.onClient.bind(this));
    }
    //////////////////////////////////////////////////////////
    onClient(data, res){
      console.log('###################################################### xxxx ',data);
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
      console.log('tell state');
      this.client.event.emit('mngr',{
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
      // AMI create obstacles here and return

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
    }
    //////////////////////////////////////////////////////////
    setFlagHolder(flagHolder, nick, res){
      this.state[flagHolder] = nick;
      res.send('ok');
      // update everyone via state
      this.tellState();
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
  }



  module.exports = {
    GameManager
  }