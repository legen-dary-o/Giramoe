const board = require('./board');

const SEGMENTS = [
  1000, 'bancarotta', 'raddoppia', 200, 400, 500, 'next', 400,
  300, 700, 500, 'next', 400, 300, 500, 'next'
];

// EXPRESS round wheel: the first "PASSA"/next segment becomes EXPRESS.
const EXPRESS_SEGMENTS = SEGMENTS.map((s, i) => (s === 'next' && i === 6) ? 'express' : s);
const EXPRESS_VALUE = 500; // every occurrence of a called consonant is worth 500

function createGame(players) {
  return {
    players: players.map(p => ({ id: p.id, name: p.name, roundPoints: 0, bank: 0 })),
    segments: SEGMENTS.slice(),
    board: null,
    boardNumber: 1,
    currentTurnIndex: 0,
    turnState: 'MUST_SPIN',
    lastSpinValue: null,
    hasScoredConsonant: false,
    usedLetters: []
  };
}

function currentPlayer(game) {
  return game.players[game.currentTurnIndex];
}

function passTurn(game) {
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length;
  game.turnState = 'MUST_SPIN';
  game.hasScoredConsonant = false;
  game.lastSpinValue = null;
}

// startBoard(game, category, phrase, startIndex, boardNumber)
function startBoard(game, category, phrase, startIndex, boardNumber) {
  const result = board.createBoard(category, phrase);
  if (!result.ok) return { ok: false, error: result.error };
  game.board = result.board;
  game.boardNumber = boardNumber;
  game.usedLetters = [];
  game.currentTurnIndex = startIndex;
  game.turnState = 'MUST_SPIN';
  game.hasScoredConsonant = false;
  game.lastSpinValue = null;
  game.players.forEach(p => { p.roundPoints = 0; });
  return { ok: true };
}

function applySpin(game, segmentIndex) {
  // A spin is allowed at the start of the turn (MUST_SPIN) and after a correct
  // letter (CONTINUE) — that is the "keep spinning until you miss" loop.
  if (game.turnState !== 'MUST_SPIN' && game.turnState !== 'CONTINUE') return { ok: false };
  const seg = game.segments[segmentIndex];
  if (seg === 'next') {
    passTurn(game);
    return { type: 'next' };
  }
  if (seg === 'bancarotta') {
    const p = currentPlayer(game);
    p.roundPoints = 0;
    p.bank = 0;
    passTurn(game);
    return { type: 'bancarotta' };
  }
  if (seg === 'raddoppia') {
    game.turnState = 'PICK_CONSONANT_DOUBLE';
    return { type: 'raddoppia' };
  }
  if (seg === 'express') {
    // Express mode starts immediately: no spin/letter gate, rapid-fire from here.
    game.turnState = 'EXPRESS';
    return { type: 'express' };
  }
  game.lastSpinValue = seg;
  game.turnState = 'PICK_CONSONANT';
  return { type: 'number', value: seg };
}

function applyConsonant(game, letter) {
  letter = String(letter).toUpperCase();
  if (game.turnState !== 'PICK_CONSONANT' && game.turnState !== 'PICK_CONSONANT_DOUBLE') {
    return { ok: false };
  }
  if (!board.isConsonant(letter) || game.usedLetters.includes(letter)) {
    return { ok: false };
  }
  const count = board.countOccurrences(game.board.grid, letter);
  const p = currentPlayer(game);
  const doubling = game.turnState === 'PICK_CONSONANT_DOUBLE';

  if (count > 0) {
    const positions = board.letterPositions(game.board.grid, letter);
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    if (doubling) {
      p.roundPoints = p.roundPoints * 2;
    } else {
      p.roundPoints += game.lastSpinValue * count;
    }
    game.hasScoredConsonant = true;
    game.turnState = 'CONTINUE';
    return { ok: true, present: true, count, positions, solved: board.isSolved(game.board.grid) };
  }
  passTurn(game);
  return { ok: true, present: false, count: 0, positions: [] };
}

function canBuyVowel(game) {
  const p = currentPlayer(game);
  return game.turnState === 'CONTINUE' && game.hasScoredConsonant && p.roundPoints >= 500;
}

function applyVowel(game, letter) {
  letter = String(letter).toUpperCase();
  if (!canBuyVowel(game)) return { ok: false };
  if (!board.isVowel(letter) || game.usedLetters.includes(letter)) return { ok: false };
  const p = currentPlayer(game);
  p.roundPoints -= 500;
  const count = board.countOccurrences(game.board.grid, letter);
  if (count > 0) {
    const positions = board.letterPositions(game.board.grid, letter);
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    game.turnState = 'CONTINUE';
    return { ok: true, present: true, count, positions, solved: board.isSolved(game.board.grid) };
  }
  passTurn(game);
  return { ok: true, present: false, count: 0, positions: [] };
}

function applySolve(game) {
  const p = currentPlayer(game);
  board.revealAll(game.board.grid);
  p.bank += p.roundPoints;
  return { ok: true, solvedBy: p.id };
}

// --- EXPRESS mode (express round only) ---

// Full bankruptcy: wipe the turn points AND the player's whole bank, then pass.
function expressBankrupt(game) {
  const p = currentPlayer(game);
  p.roundPoints = 0;
  p.bank = 0;
  passTurn(game);
}

// Rapid-fire letter in express mode. Consonants score 500 x occurrences; vowels are
// bought for 500 (reveal only, no points). Any absent letter -> full bancarotta + pass.
function applyExpressLetter(game, letter) {
  letter = String(letter).toUpperCase();
  if (game.turnState !== 'EXPRESS') return { ok: false };
  if (!/^[A-Z]$/.test(letter) || game.usedLetters.includes(letter)) return { ok: false };

  const p = currentPlayer(game);
  const vowel = board.isVowel(letter);
  if (vowel) {
    if (p.roundPoints < 500) return { ok: false, reason: 'cantBuyVowel' };
    p.roundPoints -= 500;
  }

  const count = board.countOccurrences(game.board.grid, letter);
  if (count > 0) {
    const positions = board.letterPositions(game.board.grid, letter);
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    if (!vowel) p.roundPoints += EXPRESS_VALUE * count;
    return { ok: true, present: true, vowel, count, positions, solved: board.isSolved(game.board.grid) };
  }

  expressBankrupt(game);
  return { ok: true, present: false, vowel, count: 0, positions: [], bankrupt: true };
}

// Player tried to solve in express and got it wrong -> full bancarotta + pass.
function applyExpressWrongSolve(game) {
  if (game.turnState !== 'EXPRESS') return { ok: false };
  expressBankrupt(game);
  return { ok: true, bankrupt: true };
}

module.exports = {
  SEGMENTS, EXPRESS_SEGMENTS, EXPRESS_VALUE,
  createGame, currentPlayer, passTurn, startBoard,
  applySpin, applyConsonant, canBuyVowel, applyVowel, applySolve,
  applyExpressLetter, applyExpressWrongSolve, expressBankrupt
};
