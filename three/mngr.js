class Mngr /*extends THREE.EventDispatcher*/ {
  //////////////////////////////////////////////////////////
  constructor(){
    this.state = {
      started:false, // playing now
      ready:false, // enough players are connected
      red:[],
      blue:[],
      redFlag:"blueGate",
      blueFlag:"redGate",
    };
    localStorage.setItem('state', this.state);
  }
  //////////////////////////////////////////////////////////
  start(){
    deepStream.subscribe('player', this.onEvent.bind(this));
    // deepStream.sendEvent('mngr.up',{
    //   type:"up",
    //   state:this.state
    // });
    //setFields
    this.updateUI();
  }
  //////////////////////////////////////////////////////////
  onEvent(data){
    console.log('onEvent player', data);
    switch(data.type){
      case "online":
        deepStream.sendEvent('mngr',{
          type:"state",
          state:this.state
        });
        // reply with state
        break;
      case "join":
        break;
      case "explode":
        break;
    }
  }
  //////////////////////////////////////////////////////////
  updateUI(){
    $('#status').text(`status: ${this.state.status}`)

  }
}

$(document).ready(function(){
  let mngr = new Mngr();
  mngr.start();
})