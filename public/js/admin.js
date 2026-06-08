const socket = io();

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

socket.emit('admin:init');

// --- Pre-game ---

document.getElementById('btn-inizia').addEventListener('click', () => {
  socket.emit('admin:inizia');
});

// --- State updates ---

socket.on('admin:state', (game) => {
  if (game.phase === 'video') {
    showScreen('admin-pregame');
  } else if (game.phase === 'lobby') {
    showScreen('admin-lobby');
    updateLobbyPlayers(game.players);
    document.getElementById('btn-avvia').disabled = game.players.length < 3;
  } else if (game.phase === 'playing') {
    showScreen('admin-game');
    updateGamePlayers(game.players, game.currentTurnIndex);
  }
});

socket.on('admin:spinning', ({ segmentText, playerIndex }) => {
  // Could show spinning indicator
});

// --- Lobby ---

function updateLobbyPlayers(players) {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`ap-${i}`);
    if (players[i]) {
      el.querySelector('span:first-child').textContent = players[i].name;
      el.querySelector('.status-dot').classList.remove('disconnected');
    } else {
      el.querySelector('span:first-child').textContent = 'In attesa...';
      el.querySelector('.status-dot').classList.add('disconnected');
    }
  }
}

// --- Start game ---

document.getElementById('btn-avvia').addEventListener('click', () => {
  socket.emit('admin:startGame');
});

// --- Game ---

function updateGamePlayers(players, currentTurn) {
  const container = document.getElementById('admin-game-players');
  container.innerHTML = '';

  const turnName = document.getElementById('admin-turn-name');
  turnName.textContent = players[currentTurn] ? players[currentTurn].name : '—';

  players.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'admin-player-item glass-panel';
    if (i === currentTurn) {
      item.style.border = '1px solid rgba(100, 180, 255, 0.5)';
      item.style.boxShadow = '0 0 12px rgba(100, 180, 255, 0.2)';
    }
    item.innerHTML = `
      <span>${p.name}</span>
      <span class="status-dot ${p.connected ? '' : 'disconnected'}"></span>
    `;
    container.appendChild(item);
  });
}
