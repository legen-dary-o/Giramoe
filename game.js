const board = require('./board');

const SEGMENTS = [
  1000, 'bancarotta', 'raddoppia', 200, 400, 500, 'next', 400,
  300, 700, 500, 'next', 400, 300, 500, 'next'
];

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
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    if (doubling) {
      p.roundPoints = p.roundPoints * 2;
    } else {
      p.roundPoints += game.lastSpinValue * count;
    }
    game.hasScoredConsonant = true;
    game.turnState = 'CONTINUE';
    return { ok: true, present: true, count, solved: board.isSolved(game.board.grid) };
  }
  passTurn(game);
  return { ok: true, present: false, count: 0 };
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
    board.revealLetter(game.board.grid, letter);
    game.usedLetters.push(letter);
    game.turnState = 'CONTINUE';
    return { ok: true, present: true, count, solved: board.isSolved(game.board.grid) };
  }
  passTurn(game);
  return { ok: true, present: false, count: 0 };
}

function applySolve(game) {
  const p = currentPlayer(game);
  board.revealAll(game.board.grid);
  p.bank += p.roundPoints;
  return { ok: true, solvedBy: p.id };
}

module.exports = {
  SEGMENTS, createGame, currentPlayer, passTurn, startBoard,
  applySpin, applyConsonant, canBuyVowel, applyVowel, applySolve
};
