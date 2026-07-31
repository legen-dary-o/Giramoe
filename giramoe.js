const board = require('./board');

const VOWEL_COST = 500; // price of a vowel, same as in the other rounds

// GIRAMOE — the final wheel board. The admin spins the wheel once for a multiplier
// V; players then take turns making ONE move each: call a consonant, or buy a
// vowel for 500 of their giramoe points (reveal only, no points). A present
// consonant scores V x occurrences for that player and opens a short window to buzz
// and solve aloud; an absent consonant scores nothing and passes the turn (no buzz).
// Only the player who solves banks their own points; everyone else banks nothing.
// Pure state machine — the 5s buzz timer lives in server.js.

// Chi apre il Giramoe: il giocatore che arriva dall'Express con la banca più alta.
// A pari merito si sorteggia fra i primi (rng iniettabile per rendere i test
// deterministici). Torna l'indice nell'array passato, che è anche l'indice di turno.
function startingTurnIndex(players, rng = Math.random) {
  const bankOf = p => p.bank || 0;
  const max = Math.max(...players.map(bankOf));
  const top = players.reduce((acc, p, i) => (bankOf(p) === max ? acc.concat(i) : acc), []);
  return top[Math.min(top.length - 1, Math.floor(rng() * top.length))];
}

// `startIndex` è chi muove per primo: il chiamante lo ricava da startingTurnIndex
// sulle banche di fine Express.
function createGiramoe(players, category, phrase, startIndex = 0) {
  const r = board.createBoard(category, phrase);
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    gi: {
      board: r.board,
      // lastLetter/lastCount servono solo alla console dell'admin: mostra
      // cosa ha chiamato ciascuno e quanto ha reso, che dallo schermo grande
      // non si ricostruisce.
      players: players.map(p => ({ id: p.id, name: p.name, points: 0, lastLetter: null, lastCount: 0 })),
      multiplier: null,
      currentTurnIndex: startIndex,
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
    const chiamante = currentPlayer(gi);
    chiamante.points += gi.multiplier * count;
    chiamante.lastLetter = letter;
    chiamante.lastCount = count;
    gi.calledThisTurn = true; // only a present consonant opens the buzz window
    return { ok: true, present: true, count, positions };
  }
  // Absent consonant: NOT recorded, so it stays callable on later turns (players
  // must remember which letters aren't in the phrase). Scores nothing and passes.
  passTurn(gi);
  return { ok: true, present: false, count: 0, positions: [], passed: true };
}

// The current player buys a vowel with 500 of their giramoe points, in place of
// calling a consonant. Present -> revealed (no points) and the buzz window opens,
// exactly as after a present consonant. Absent -> the 500 are lost, no buzz, and
// the turn passes.
function buyVowel(gi, letter) {
  letter = String(letter).toUpperCase();
  if (!canBuyVowel(gi, gi.currentTurnIndex)) return { ok: false };
  if (!board.isVowel(letter) || gi.usedLetters.includes(letter)) return { ok: false };

  const p = currentPlayer(gi);
  p.points -= VOWEL_COST;

  const count = board.countOccurrences(gi.board.grid, letter);
  if (count > 0) {
    const positions = board.letterPositions(gi.board.grid, letter);
    board.revealLetter(gi.board.grid, letter);
    gi.usedLetters.push(letter);
    p.lastLetter = letter;   // la vocale comprata non dà punti ma è pur sempre la sua mossa
    p.lastCount = count;
    gi.calledThisTurn = true; // turn's move spent: opens the buzz window
    return { ok: true, present: true, count, positions };
  }
  // Absent vowel: NOT recorded, so it stays purchasable on later turns — same rule
  // as an absent consonant called this round.
  passTurn(gi);
  return { ok: true, present: false, count: 0, positions: [], passed: true };
}

// Every consonant that appears in the phrase has been revealed -> nothing left to call.
function consonantsFinished(gi) {
  return board.boardStatus(gi.board.grid).consonantsFinished;
}

// Every vowel that appears in the phrase has been revealed -> nothing left to buy.
function vowelsFinished(gi) {
  return board.boardStatus(gi.board.grid).vowelsFinished;
}

// The current player may buy a vowel in place of calling a consonant: only one move
// per turn, so buying closes as soon as a letter has been called (and conversely,
// callConsonant already rejects once calledThisTurn is true).
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
  createGiramoe, startingTurnIndex, currentPlayer, setMultiplier, passTurn,
  callConsonant, buyVowel, consonantsFinished, vowelsFinished, canBuyVowel,
  buzz, judgeCorrect, judgeWrong, timeout, bankResult
};
