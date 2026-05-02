(function () {
  'use strict';

  // --- DOM refs ---
  const nickInput = document.getElementById('nick-input');
  const roomBrowser = document.getElementById('room-browser');
  const roomList = document.getElementById('room-list');
  const createRoomBtn = document.getElementById('create-room-btn');
  const roomView = document.getElementById('room-view');
  const roomNameEl = document.getElementById('room-name');
  const leaveRoomBtn = document.getElementById('leave-room-btn');
  const inviteLinkInput = document.getElementById('invite-link');
  const copyInviteBtn = document.getElementById('copy-invite');
  const teamAList = document.getElementById('team-a-list');
  const teamBList = document.getElementById('team-b-list');
  const teamACount = document.getElementById('team-a-count');
  const teamBCount = document.getElementById('team-b-count');
  const joinTeamA = document.getElementById('join-team-a');
  const joinTeamB = document.getElementById('join-team-b');
  const startGameBtn = document.getElementById('start-game-btn');
  const trainBtn = document.getElementById('train-btn');
  const createModal = document.getElementById('create-modal');
  const roomNameInput = document.getElementById('room-name-input');
  const confirmCreate = document.getElementById('confirm-create');
  const cancelCreate = document.getElementById('cancel-create');
  const trainModal = document.getElementById('train-modal');
  const trainPickRed = document.getElementById('train-pick-red');
  const trainPickBlue = document.getElementById('train-pick-blue');
  const cancelTrain = document.getElementById('cancel-train');
  const toastEl = document.getElementById('toast');

  // Track which room the train modal is targeting
  let trainTargetRoomId = null;

  // --- state ---
  let ws = null;
  let currentRoom = null;   // room JSON from server
  let myNick = '';
  let pollTimer = null;

  // restore nick from localStorage
  const savedNick = localStorage.getItem('makers21_nick');
  if (savedNick) nickInput.value = savedNick;

  nickInput.addEventListener('change', () => {
    localStorage.setItem('makers21_nick', nickInput.value.trim());
    refreshRoomList();
  });

  // --- API helpers ---
  const API = '/api/rooms';

  function getBaseUrl() {
    return `${location.protocol}//${location.host}`;
  }

  function getWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
  }

  async function fetchRooms() {
    const res = await fetch(API);
    return res.json();
  }

  async function createRoom(name, hostNick) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, hostNick }),
    });
    return res.json();
  }

  // --- room list rendering ---
  function renderRoomList(rooms) {
    if (rooms.length === 0) {
      roomList.innerHTML = '<div class="empty-state">No rooms yet. Create one!</div>';
      return;
    }

    const currentNick = nickInput.value.trim();

    roomList.innerHTML = rooms.map(r => {
      const isMine = currentNick && r.hostNick === currentNick;
      const isAlone = isMine && r.playerCount <= 1 && r.status === 'waiting';
      const canJoin = r.status === 'waiting' && !isAlone;
      return `
      <div class="room-card" data-room-id="${r.id}">
        <div class="room-info">
          <div class="room-name">${esc(r.name)}</div>
          <div class="room-meta">
            ${r.playerCount}/${r.maxTeamSize * 2} players
            &middot; A: ${r.teamACount} / B: ${r.teamBCount}
            <span class="status-badge status-${r.status}">${r.status}</span>
          </div>
        </div>
        <div class="room-card-actions">
          <button class="join-room-btn btn-small" ${canJoin ? '' : 'disabled'}>Join</button>
          ${isAlone ? '<button class="train-room-btn btn-small btn-primary">Train</button>' : ''}
          ${isAlone ? '<button class="leave-room-card-btn btn-small btn-danger">Leave</button>' : ''}
        </div>
      </div>
    `;
    }).join('');

    // bind action buttons
    roomList.querySelectorAll('.join-room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.room-card');
        joinRoom(card.dataset.roomId);
      });
    });
    roomList.querySelectorAll('.train-room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.room-card');
        openTrainModal(card.dataset.roomId);
      });
    });
    roomList.querySelectorAll('.leave-room-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.room-card');
        deleteRoom(card.dataset.roomId);
      });
    });
  }

  async function refreshRoomList() {
    try {
      const rooms = await fetchRooms();
      renderRoomList(rooms);
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    }
  }

  function startPolling() {
    refreshRoomList();
    pollTimer = setInterval(refreshRoomList, 3000);
  }

  function stopPolling() {
    clearInterval(pollTimer);
  }

  // --- WebSocket ---
  function connectWS() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(getWsUrl());
      socket.addEventListener('open', () => resolve(socket));
      socket.addEventListener('error', reject);
      socket.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);
        handleServerMessage(msg);
      });
      socket.addEventListener('close', () => {
        // if we're in a room, go back to browser
        if (currentRoom) {
          currentRoom = null;
          showBrowser();
          toast('Disconnected from room');
        }
        ws = null;
      });
    });
  }

  function wsSend(type, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  }

  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'roomState':
        currentRoom = msg.data;
        renderRoomView();
        break;
      case 'playerJoined':
        // full state will follow via roomState broadcast
        break;
      case 'playerLeft':
        break;
      case 'playerKicked':
        if (msg.data.nick === myNick) {
          currentRoom = null;
          showBrowser();
          toast('You were kicked from the room');
        }
        break;
      case 'gameStarting':
        onGameStarting(msg.data);
        break;
      case 'error':
        toast(msg.data.message);
        break;
    }
  }

  // --- join room ---
  async function joinRoom(roomId) {
    myNick = nickInput.value.trim();
    if (!myNick) {
      toast('Enter a callsign first');
      nickInput.focus();
      return;
    }
    localStorage.setItem('makers21_nick', myNick);

    try {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = await connectWS();
      }
      wsSend('joinRoom', { roomId, nick: myNick });
      stopPolling();
      showRoom();
    } catch (e) {
      toast('Failed to connect');
    }
  }

  // --- train: join room + pick chosen team + start training ---
  async function trainInRoom(roomId, team) {
    myNick = nickInput.value.trim();
    if (!myNick) {
      toast('Enter a callsign first');
      nickInput.focus();
      return;
    }
    if (team !== 'A' && team !== 'B') {
      toast('Pick a team first');
      return;
    }

    try {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = await connectWS();
      }

      // Wait for room state confirming join, then pick team and start
      const onState = (data) => {
        if (data.id !== roomId) return;
        const myPlayer = data.teamA.includes(myNick) || data.teamB.includes(myNick);
        if (!myPlayer) {
          wsSend('pickTeam', { team });
        } else {
          ws.removeEventListener('message', stateHandler);
          wsSend('startTraining');
        }
      };
      const stateHandler = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'roomState') onState(msg.data);
      };
      ws.addEventListener('message', stateHandler);

      wsSend('joinRoom', { roomId, nick: myNick });
      stopPolling();
    } catch (e) {
      toast('Failed to start training');
    }
  }

  // --- delete a room (host only) ---
  async function deleteRoom(roomId) {
    const hostNick = nickInput.value.trim();
    try {
      const res = await fetch(`${API}/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostNick }),
      });
      const result = await res.json();
      if (result.error) {
        toast(result.error);
      } else {
        toast('Room deleted');
        refreshRoomList();
      }
    } catch (e) {
      toast('Failed to delete room');
    }
  }

  // --- room view rendering ---
  function renderRoomView() {
    if (!currentRoom) return;

    roomNameEl.textContent = currentRoom.name;
    inviteLinkInput.value = `${getBaseUrl()}?room=${currentRoom.id}`;

    // teams
    teamACount.textContent = `${currentRoom.teamA.length}/${currentRoom.maxTeamSize}`;
    teamBCount.textContent = `${currentRoom.teamB.length}/${currentRoom.maxTeamSize}`;

    teamAList.innerHTML = currentRoom.teamA.map(nick => renderPlayerLi(nick)).join('');
    teamBList.innerHTML = currentRoom.teamB.map(nick => renderPlayerLi(nick)).join('');

    const isHost = myNick === currentRoom.hostNick;
    const hasPickedTeam = currentRoom.teamA.includes(myNick) || currentRoom.teamB.includes(myNick);
    const bothTeamsHavePlayers = currentRoom.teamA.length > 0 && currentRoom.teamB.length > 0;

    // Go to Game: any team member can transition individually.
    // Disabled until they've picked a team AND both teams have ≥1 player.
    startGameBtn.style.display = hasPickedTeam ? '' : 'none';
    startGameBtn.disabled = !bothTeamsHavePlayers;

    // Train: host only, solo only, must have picked a team
    trainBtn.style.display = isHost ? '' : 'none';
    trainBtn.disabled = currentRoom.playerCount > 1 || !hasPickedTeam;

    // bind kick buttons for host
    if (isHost) {
      document.querySelectorAll('.kick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          wsSend('kickPlayer', { targetNick: btn.dataset.nick });
        });
      });
    }
  }

  function renderPlayerLi(nick) {
    const isHost = nick === currentRoom.hostNick;
    const isMe = nick === myNick;
    const canKick = myNick === currentRoom.hostNick && !isMe;

    return `<li>
      <span>${esc(nick)}${isHost ? '<span class="host-badge">HOST</span>' : ''}${isMe ? ' (you)' : ''}</span>
      ${canKick ? `<button class="kick-btn btn-danger btn-small" data-nick="${esc(nick)}">Kick</button>` : ''}
    </li>`;
  }

  // --- game start redirect ---
  function onGameStarting(data) {
    const { roomId, team, nick } = data;
    // redirect to game page
    const gameUrl = `game.html?roomId=${roomId}&team=${team}&nick=${encodeURIComponent(nick)}`;
    window.location.href = gameUrl;
  }

  // --- view switching ---
  function showBrowser() {
    roomBrowser.style.display = 'block';
    roomView.style.display = 'none';
    startPolling();
  }

  function showRoom() {
    roomBrowser.style.display = 'none';
    roomView.style.display = 'block';
  }

  // --- toast ---
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2500);
  }

  // --- create room modal ---
  createRoomBtn.addEventListener('click', () => {
    myNick = nickInput.value.trim();
    if (!myNick) {
      toast('Enter a callsign first');
      nickInput.focus();
      return;
    }
    roomNameInput.value = '';
    createModal.classList.add('open');
    roomNameInput.focus();
  });

  cancelCreate.addEventListener('click', () => {
    createModal.classList.remove('open');
  });

  createModal.addEventListener('click', (e) => {
    if (e.target === createModal) createModal.classList.remove('open');
  });

  confirmCreate.addEventListener('click', async () => {
    const name = roomNameInput.value.trim();
    if (!name) {
      toast('Enter a room name');
      return;
    }
    localStorage.setItem('makers21_nick', myNick);

    try {
      const result = await createRoom(name, myNick);
      if (result.error) {
        toast(result.error);
        return;
      }
      createModal.classList.remove('open');
      // join the room we just created
      joinRoom(result.roomId);
    } catch (e) {
      toast('Failed to create room');
    }
  });

  roomNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmCreate.click();
  });

  // --- team buttons ---
  joinTeamA.addEventListener('click', () => wsSend('pickTeam', { team: 'A' }));
  joinTeamB.addEventListener('click', () => wsSend('pickTeam', { team: 'B' }));

  // --- start game ---
  startGameBtn.addEventListener('click', () => wsSend('startGame'));

  // --- train (solo with bots) ---
  trainBtn.addEventListener('click', () => wsSend('startTraining'));

  // --- train team picker modal ---
  function openTrainModal(roomId) {
    if (!nickInput.value.trim()) {
      toast('Enter a callsign first');
      nickInput.focus();
      return;
    }
    trainTargetRoomId = roomId;
    trainModal.classList.add('open');
  }
  function closeTrainModal() {
    trainModal.classList.remove('open');
    trainTargetRoomId = null;
  }
  trainPickRed.addEventListener('click', () => {
    const roomId = trainTargetRoomId;
    closeTrainModal();
    if (roomId) trainInRoom(roomId, 'A');
  });
  trainPickBlue.addEventListener('click', () => {
    const roomId = trainTargetRoomId;
    closeTrainModal();
    if (roomId) trainInRoom(roomId, 'B');
  });
  cancelTrain.addEventListener('click', closeTrainModal);
  trainModal.addEventListener('click', (e) => {
    if (e.target === trainModal) closeTrainModal();
  });

  // --- leave room ---
  leaveRoomBtn.addEventListener('click', () => {
    wsSend('leaveRoom');
    currentRoom = null;
    if (ws) ws.close();
    showBrowser();
  });

  // --- copy invite link ---
  copyInviteBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(inviteLinkInput.value).then(() => {
      toast('Copied!');
    });
  });

  // --- escape html ---
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- init ---
  const params = new URLSearchParams(location.search);

  // show error message if redirected from game page (e.g. room not found)
  const errorMsg = params.get('error');
  if (errorMsg) {
    setTimeout(() => toast(errorMsg), 100);
    // strip error from URL so refresh doesn't re-show it
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete('error');
    window.history.replaceState({}, '', cleanUrl);
  }

  // check for ?room= param (invite link)
  const inviteRoomId = params.get('room');

  if (inviteRoomId) {
    // auto-join after user sets nick
    const tryJoin = () => {
      if (nickInput.value.trim()) {
        joinRoom(inviteRoomId);
      } else {
        toast('Enter a callsign to join the room');
        nickInput.focus();
        nickInput.addEventListener('change', function once() {
          nickInput.removeEventListener('change', once);
          if (nickInput.value.trim()) joinRoom(inviteRoomId);
        });
      }
    };
    tryJoin();
  }

  startPolling();
})();
