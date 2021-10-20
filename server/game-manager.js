const dummyInterval = 1000;
class GameManager /*extends THREE.EventDispatcher*/ {
    //////////////////////////////////////////////////////////
    constructor(deepStream){
      this.client = deepStream;
      this.resetState();
      this.init();
      //this.client.event.subscribe('managerState', state => {this.state = state});
    }
    //////////////////////////////////////////////////////////
    moveDum(){
      //console.log('move dummies');
      const direction = {x:0,y:0,z:0};
      const posFactor = 0.5;
      for(let d of this.dummies){
        d.pos.x += posFactor *(Math.random() - 1);
        d.pos.y += posFactor/10 *(Math.random() - 1);
        d.pos.z += posFactor *(Math.random() - 1);
        this.client.event.emit('player',{
          type:"pos",
          targetPos:d.pos,
          dir:direction,
          nick: d.nick,
           // old
          //pos:cam.position,
          moving: true,
          // new
          targetTS: Date.now() + dummyInterval
          //quaternion: quaternion
        });
      }
    }
    //////////////////////////////////////////////////////////
    addDumTeam(isRed, indx){
      const nick = (isRed? 'red':'blue') + '_dummie_'+ indx;
      console.log('add dummie', nick);
      const dum = {
        nick: nick,
        pos:{
          x:10 *(Math.random() - 1),
          y:5,z:0,
          z:10 *(Math.random() - 1),
        }
      }
      this.dummies.push(dum);

      if(isRed){
        this.state.red.push(nick);
      }
      else{
        this.state.blue.push(nick);
      }
      this.tellState();
    }
    //////////////////////////////////////////////////////////
    addDum(){
      let indx = this.state.red?.length;
      // red
      this.addDumTeam(true, indx);
      // blue
      this.addDumTeam(false, indx);
      // move random
      if(!this.tidMoveDum){
        this.tidMoveDum = setInterval(this.moveDum.bind(this), dummyInterval);
      }
    }
    //////////////////////////////////////////////////////////
    resetState(){
      this.state = {
        started:false, // playing now
        ready:false, // enough players are connected
        red:[],
        blue:[],
        clients:[],
        redHolder:null,
        blueHolder:null,
        winnerNick:null,
        winnerIsRed:false
      };
      // reset dummies
      this.dummies = [];
      if(this.tidMoveDum){
        clearInterval(this.tidMoveDum);
        this.tidMoveDum =- 0;
      }
    }
    //////////////////////////////////////////////////////////
    reset(){
      this.resetState();
      this.state.needReset = true;
      this.tellState();
      this.state.needReset = false;
    }
    //////////////////////////////////////////////////////////
    init(){
      //$('#reset').click(this.reset.bind(this));
      //setFields

      // this.client.event.subscribe('player', (data)=>{
      //   console.log('player ', data);
      // })

      // this.client.event.subscribe('mngr-ui', (data)=>{
      //   this.tellState();
      // });

      // rpcServer.
      this.client.rpc.provide('client', this.onClient.bind(this));
    }
    //////////////////////////////////////////////////////////
    onClient(data, res){
      console.log('###################################################### xxxx ',data);
      switch(data.type){
        case 'online':
          this.onOnline(data, res);
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
        case 'add-dum':
          this.addDum();
          res.send('ok');
          break;
        case 'passFlag':
          this.onPassFlag(data, res);
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
      dt.setSeconds( dt.getSeconds() + 4, 0 );
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
    onOnline(data, res){
      //console.log("onOnline",data, res);
      if(!this.state.clients.includes(res.correlationId)){
        //console.log('+++add CLIENT ID', res.correlationId);
        this.state.clients.push(res.correlationId);
      }
      res.send({status:'ok',state:this.state});
      //this.tellState(); - NO NEED
    }
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
      if(this.state[flagHolder] === data.nick){
        this.setFlagHolder(flagHolder, null, res);
      }else{
        res.send(`The flag is not held by [${data.nick}] to drop`);
      }
    }
    //////////////////////////////////////////////////////////
    onPassFlag(data, res){
      // make sure requestor is holding the flagHolder
      const flagHolder = data.isRed? 'blueHolder':'redHolder';
      if(this.state[flagHolder] !== data.nick){
        res.send(`${this.state[flagHolder]} the flag is not held by [${data.nick}] to pass`);
        return;
      }
      this.setFlagHolder(flagHolder, data.targetNick, res);
    }
  }



  module.exports = {
    GameManager
  }