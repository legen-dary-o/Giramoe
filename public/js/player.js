const socket = io();

const params = new URLSearchParams(window.location.search);
const roomCode = params.get('room');

let playerWheel = null;
let myIndex = -1;
let myName = '';
let isMyTurn = false;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// --- Join ---

document.getElementById('btn-join').addEventListener('click', () => {
  const name = document.getElementById('nick-input').value.trim();
  if (!name) return;
  myName = name;

  const saved = sessionStorage.getItem('giramoe-player');
  if (saved) {
    const data = JSON.parse(saved);
    if (data.roomCode === roomCode) {
      socket.emit('player:reconnect', { roomCode, name: data.name });
      return;
    }
  }

  socket.emit('player:join', { roomCode, name });
});

document.getElementById('nick-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// --- Socket events ---

socket.on('player:joined', ({ playerIndex, name }) => {
  myIndex = playerIndex;
  myName = name;
  sessionStorage.setItem('giramoe-player', JSON.stringify({ roomCode, name }));
  showScreen('wait-screen');
});

socket.on('player:error', (msg) => {
  alert(msg);
});

socket.on('player:gameStarted', ({ currentTurn, playerIndex, players }) => {
  myIndex = playerIndex;
  showScreen('player-game-screen');
  document.getElementById('player-nick-display').textContent = myName;
  initPlayerWheel();
  updateTurn(currentTurn);
});

socket.on('player:spinResult', ({ totalAngle, winningSegment }) => {
  if (playerWheel) {
    playerWheel.spinTo(totalAngle, 6000);
  }
});

socket.on('player:turnUpdate', ({ currentTurn, playerIndex }) => {
  myIndex = playerIndex;
  updateTurn(currentTurn);
});

socket.on('player:waitReconnect', ({ disconnectedPlayer }) => {
  document.getElementById('disconnect-overlay').classList.add('visible');
});

socket.on('player:resumeGame', ({ currentTurn, playerIndex }) => {
  myIndex = playerIndex;
  document.getElementById('disconnect-overlay').classList.remove('visible');
  updateTurn(currentTurn);
});

socket.on('player:reconnected', ({ playerIndex, name, phase, currentTurn }) => {
  myIndex = playerIndex;
  myName = name;
  if (phase === 'playing') {
    showScreen('player-game-screen');
    document.getElementById('player-nick-display').textContent = myName;
    initPlayerWheel();
    updateTurn(currentTurn);
  } else {
    showScreen('wait-screen');
  }
});

// --- Wheel ---

function initPlayerWheel() {
  const canvas = document.getElementById('player-wheel-canvas');
  playerWheel = new Wheel(canvas, {
    segments: 16,
    labels: [],
    showLabels: false
  });

  canvas.addEventListener('click', () => {
    if (isMyTurn && !playerWheel.spinning) {
      socket.emit('player:spin');
    }
  });

  window.addEventListener('resize', () => playerWheel.resize());
}

function updateTurn(currentTurn) {
  isMyTurn = currentTurn === myIndex;
  const msg = document.getElementById('turn-message');
  const container = document.getElementById('player-wheel-container');

  if (isMyTurn) {
    msg.textContent = 'Tocca a te! Gira la ruota';
    msg.className = 'turn-message your-turn';
    container.classList.remove('disabled');
  } else {
    msg.textContent = 'Attendi il tuo turno';
    msg.className = 'turn-message waiting';
    container.classList.add('disabled');
  }
}
