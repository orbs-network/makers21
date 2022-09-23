class Mngr /*extends THREE.EventDispatcher*/ {
  //////////////////////////////////////////////////////////
  constructor(){
    this.resetState();

    // get initial state
    // get updates
    deepStream.subscribe('mngr',(data)=> {
      this.state = data.state;
      this.updateUI(this.state);
    });

    deepStream.client.rpc.make( 'client', {type:'online'}, (error, result) => {
      if(error){
        console.error(error);
        this.onOffline();
        return;
      }
      this.state = result.state;
      this.updateUI(this.state);
    });

    $('#reset').click((e) => {
      deepStream.client.rpc.make( 'client', {
        type:'reset',
        nick:'mngr-client'}, (error, result) => {
          if(error){
            console.error('reset',error);
            return;
          }
      });
    });
    $('#add-dum').click((e) => {
      deepStream.client.rpc.make( 'client', {
        type:'add-dum',
        nick:'mngr-client'}, (error, result) => {
          if(error){
            console.error('reset',error);
            return;
          }
      });
    });

    //this.addDummies();
  }
  //////////////////////////////////////////////////////////
  // addDummies() {}{
  // }
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
  }
  //////////////////////////////////////////////////////////
  updateUI(state){
    // game started
    $('#started').text(`started: ${state.started? 'true':'pending'}`);
    $('#ready').text(`ready: ${state.ready? 'yes':'team size not equal or zero'}`);
    $('#winnerNick').text('Winner is:' +state.winnerNick);
    $('#winnerIsRed').text('Winning Team is:' +state.winnerIsRed);
    if(state.winnerNick){
      $('#winnerIsRed').removeClass(state.winnerIsRed? 'blue':'red');
      $('#winnerIsRed').addClass(state.winnerIsRed? 'red':'blue');
    }

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
    $('#redHolder').text(state.redHolder || 'NONE');
    $('#blueHolder').text(state.blueHolder || 'NONE');

    // clients connected
    const $clients = $('#clients');
    $.each(state.clients, function(i){
        var li = $('<li/>').appendTo($clients);
        li.text(state.clients[i]);
    });

    // reset
    if(state.started){
      $('#reset').show();
    }else{
      $('#reset').hide();
    }
  }
}

$(document).ready(function(){
  new Mngr();
})
