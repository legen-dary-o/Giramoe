const board = require('./board');

const VOWEL_COST = 500; // prezzo di una vocale, come negli altri round

// GIRAMOE — the final wheel board. The admin spins the wheel once for a multiplier
// V; players then take turns calling ONE consonant each (no vowels). A present
// consonant scores V x occurrences for that player and opens a short window to buzz
// and solve aloud; an absent consonant scores nothing and passes the turn (no buzz).
// Only the player who solves banks their own points; everyone else banks nothing.
// Pure state machine — the 5s buzz timer lives in server.js.

function createGiramoe(players, category, phrase) {
  const r = board.createBoard(category, phrase);
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    gi: {
      board: r.board,
      players: players.map(p => ({ id: p.id, name: p.name, points: 0 })),
      multiplier: null,
      currentTurnIndex: 0,
      calledThisTurn: false,    // a letter must be called before buzzing
      usedLetters: [],
      buzzedBy: null,
      winnerId: null,
      state: 'AWAIT_SPIN'       // AWAIT_SPIN -> PLAYING -> BUZZED -> SOLVED
    }
  };
}

function currentPlayer(gi) { return gi.players[gi.currentTurnIndex]; }

// Admin's single spin sets the per-occurrence multiplier and opens play.
function setMultiplier(gi, value) {
  if (gi.state !== 'AWAIT_SPIN') return { ok: false };
  gi.multiplier = value;
  gi.state = 'PLAYING';
  return { ok: true, value };
}

function passTurn(gi) {
  gi.currentTurnIndex = (gi.currentTurnIndex + 1) % gi.players.length;
  gi.calledThisTurn = false;
  gi.buzzedBy = null;
  gi.state = 'PLAYING';
}

// Current player calls one consonant. Present -> reveal + V x occurrences, then the
// buzz window opens (calledThisTurn = true). Absent -> no points, no buzz: the turn
// passes straight to the next player.
function callConsonant(gi, letter) {
  letter = String(letter).toUpperCase();
  if (gi.state !== 'PLAYING' || gi.calledThisTurn) return { ok: false };
  if (!board.isConsonant(letter) || gi.usedLetters.includes(letter)) return { ok: false };

  const count = board.countOccurrences(gi.board.grid, letter);
  if (count > 0) {
    const positions = board.letterPositions(gi.board.grid, letter);
    board.revealLetter(gi.board.grid, letter);
    gi.usedLetters.push(letter);   // only a present, called letter is locked out
    currentPlayer(gi).points += gi.multiplier * count;
    gi.calledThisTurn = true; // only a present consonant opens the buzz window
    return { ok: true, present: true, count, positions };
  }
  // Absent consonant: NOT recorded, so it stays callable on later turns (players
  // must remember which letters aren't in the phrase). Scores nothing and passes.
  passTurn(gi);
  return { ok: true, present: false, count: 0, positions: [], passed: true };
}

// Every consonant that appears in the phrase has been revealed -> nothing left to call.
function consonantsFinished(gi) {
  return board.boardStatus(gi.board.grid).consonantsFinished;
}

// Ogni vocale presente nella frase è stata rivelata -> non c'è più niente da comprare.
function vowelsFinished(gi) {
  return board.boardStatus(gi.board.grid).vowelsFinished;
}

// Il giocatore di turno può comprare una vocale al posto di chiamare una consonante:
// una sola azione per turno, quindi l'acquisto si chiude appena una lettera è stata
// chiamata (e viceversa: callConsonant rifiuta già quando calledThisTurn è vero).
function canBuyVowel(gi, playerIndex) {
  if (gi.state !== 'PLAYING' || gi.calledThisTurn) return false;
  if (playerIndex !== gi.currentTurnIndex) return false;
  if (vowelsFinished(gi)) return false;
  return gi.players[playerIndex].points >= VOWEL_COST;
}

// Only the current player may buzz, and normally only after they've called a present
// letter. Once every consonant is revealed there's nothing left to call, so the
// current player may buzz straight away without calling.
function buzz(gi, playerId) {
  if (gi.state !== 'PLAYING') return { ok: false };
  if (playerId !== gi.currentTurnIndex) return { ok: false };
  if (!gi.calledThisTurn && !consonantsFinished(gi)) return { ok: false };
  gi.buzzedBy = playerId;
  gi.state = 'BUZZED';
  return { ok: true, playerId };
}

// Admin: the buzzed player solved it -> board over; only they bank their points.
function judgeCorrect(gi) {
  if (gi.state !== 'BUZZED') return { ok: false };
  board.revealAll(gi.board.grid);
  const p = gi.players[gi.buzzedBy];
  gi.winnerId = p.id;
  gi.state = 'SOLVED';
  return { ok: true, winnerId: p.id, name: p.name, points: p.points };
}

// Admin: wrong solution -> pass turn, no penalty.
function judgeWrong(gi) {
  if (gi.state !== 'BUZZED') return { ok: false };
  const id = gi.buzzedBy;
  passTurn(gi);
  return { ok: true, playerId: id };
}

// The 5s window elapsed with no buzz -> pass turn.
function timeout(gi) {
  if (gi.state !== 'PLAYING' || !gi.calledThisTurn) return { ok: false };
  passTurn(gi);
  return { ok: true };
}

// Bank ONLY the winner's accumulated points into their game bank.
function bankResult(gi, gamePlayers) {
  if (gi.winnerId == null) return;
  const w = gi.players.find(p => p.id === gi.winnerId);
  const gp = gamePlayers.find(p => p.id === gi.winnerId);
  if (w && gp) gp.bank += w.points;
}

module.exports = {
  VOWEL_COST,
  createGiramoe, currentPlayer, setMultiplier, passTurn,
  callConsonant, consonantsFinished, vowelsFinished, canBuyVowel,
  buzz, judgeCorrect, judgeWrong, timeout, bankResult
};
