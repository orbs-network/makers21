class Mngr /*extends THREE.EventDispatcher*/ {
  //////////////////////////////////////////////////////////
  constructor(){
    this.resetState();

    // get initial state
    // get updates
    deepStream.subscribe('mngr',(data)=> {
      this.state = data;
      this.updateUI(data.state);
    });

    deepStream.client.rpc.make( 'client', {type:'online'}, (error, result) => {
      if(error){
        console.error(error);
        this.onOffline();
        return;
      }
      this.updateUI(result.state);
    });

    // setTimeout(()=> {
    //   deepStream.sendEvent('mngr-ui', {init:true});
    //   $("#reset").click(()=> {
    //     window.deepStream.sendEvent('reset', {});
    //   })
    // }, 500);

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
  updateUI(state){
    // game started
    $('#started').text(`started: ${state.started? 'true':'pending'}`);
    $('#ready').text(`ready: ${state.ready? 'yes':'team size not equal or zero'}`);
    $('#winnerNick').text('Winner is:' +this.state.winnerNick);
    $('#winnerIsRed').text('Winning Team is:' +this.state.winnerIsRed);
    if(this.state.winnerNick){
      $('#winnerIsRed').removeClass(this.state.winnerIsRed? 'blue':'red');
      $('#winnerIsRed').addClass(this.state.winnerIsRed? 'red':'blue');
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
  new Mngr();
})