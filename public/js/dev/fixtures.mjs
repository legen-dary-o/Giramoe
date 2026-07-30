// Contenuti d'esempio dei mockup, nella forma ESATTA dei payload del server
// (mainGameView, playerGiramoeView, envelopesView, …). Se una forma qui non
// combacia con quella di server.js, il fixture è sbagliato: la forma giusta è
// quella del server.
//
// Regola: il fixture emette solo payload di STATO. Gli eventi che innescano
// un'animazione (`main:spin` fa girare la ruota per 6s, `main:letterCalled` apre
// l'overlay del risultato) non vanno in una schermata ferma — o la schermata non
// si riesce a confrontare col render. Le scene di round le salta mock.js.

// Le griglie NON si scrivono a mano: le genera scripts/gen-fixtures.js usando
// board.js, cioè lo stesso codice del server.
import { GRIDS } from './boards.generated.mjs';

export const PLAYERS = [
  { id: 0, name: 'Marco',  roundPoints: 1400, bank: 3200, connected: true },
  { id: 1, name: 'Giulia', roundPoints: 0,    bank: 5800, connected: true },
  { id: 2, name: 'Elia',   roundPoints: 0,    bank: 2100, connected: true }
];

const PROVERBIO  = 'NON TUTTE LE CIAMBELLE RIESCONO CON IL BUCO';
const SAGGEZZA   = 'MEGLIO UN UOVO OGGI CHE UNA GALLINA DOMANI';
const VIAGGI     = 'IL GIRO DEL MONDO IN OTTANTA GIORNI';
const GEOGRAFIA  = 'LE CINQUE TERRE DELLA LIGURIA';
const CANZONI    = 'MI RITORNI IN MENTE BELLA COME SEI';

// Gli stessi 16 spicchi di game.js, più le due varianti che costruisce il server
const SEGMENTS = [1000, 'bancarotta', 'raddoppia', 200, 400, 500, 'next', 400,
                  300, 700, 500, 'next', 400, 300, 500, 'next'];
const EXPRESS_SEGMENTS = SEGMENTS.map((s, i) => (s === 'next' && i === 6 ? 'express' : s));
const GIRAMOE_VALUES = { 1: 900, 2: 600, 6: 250, 11: 800, 15: 350 };
const GIRAMOE_SEGMENTS = SEGMENTS.map((s, i) => (typeof s === 'number' ? s : GIRAMOE_VALUES[i]));

const LOBBY_URL = 'http://192.168.1.72:3000';

// Le posizioni di una lettera si leggono dalla griglia già rivelata, non si
// scrivono a mano: una coordinata sbagliata farebbe lampeggiare la casella
// sbagliata e il confronto col render sarebbe bugiardo.
const positionsOf = (grid, letter) => {
  const out = [];
  grid.forEach((row, r) => row.forEach((cell, col) => {
    if (cell.type === 'letter' && cell.revealed && cell.letter === letter) {
      out.push({ row: r, col, letter });
    }
  }));
  return out;
};

// --- forma di envelopesView() ---
const ENVELOPES = {
  envelopes: [
    { color: 'green', revealed: true,  abandoned: false, content: 'Viaggio a New York' },
    { color: 'red',   revealed: false, abandoned: false, content: null },
    { color: 'green', revealed: false, abandoned: false, content: null }
  ],
  current: 0,
  changesLeft: 1,
  state: 'CHOOSING'
};

// ============================================================ TV (index.html)

const TV = {
  // 1b · lobby col QR, due giocatori su tre collegati
  '1b': () => [
    ['main:state', { phase: 'lobby' }],
    ['main:showLobby', {
      roomCode: 'ABCD', url: LOBBY_URL,
      players: [{ name: 'Marco', connected: true }, { name: 'Giulia', connected: true }]
    }]
  ],

  // 1c · primo gioco, turno di Marco: ha appena chiamato T, uscite 3 occorrenze
  '1c': (freeze) => {
    const steps = [
      ['main:state', { phase: 'playing' }],
      ['main:gameState', {
        board: { category: 'PROVERBI', grid: GRIDS[PROVERBIO].NTE },
        scores: PLAYERS, currentTurn: 0,
        boardNumber: 1, totalBoards: 3, segments: SEGMENTS,
        currentWedge: 500
      }],
      ['main:boardStatus', { consonantsFinished: false, vowelsFinished: false }]
    ];
    // `&freeze=letter` è l'unico modo di vedere Lettera e Occorrenze: sono
    // transitori, nessun payload di stato li porta. Qui gli eventi che li
    // riempiono sono voluti, ed è per questo che i fixture con freeze sono
    // esclusi dal divieto di eventi con animazione (vedi tests/fixtures.test.js).
    if (freeze === 'letter') {
      steps.push(['main:letterCalled', { letter: 'T' }]);
      steps.push(['main:revealLetter', {
        positions: [{ row: 0, col: 6, letter: 'T' }, { row: 0, col: 8, letter: 'T' }, { row: 0, col: 9, letter: 'T' }]
      }]);
    }
    return steps;
  },

  // 1e · Triplete: Marco prenotato, Giulia bloccata
  '1e': () => [
    ['main:state', { phase: 'triplete' }],
    ['main:tripleteBoard', {
      category: 'SAGGEZZA POPOLARE', boardNumber: 2, totalBoards: 3,
      grid: GRIDS[SAGGEZZA].CELLE
    }],
    ['main:tripleteScores', {
      scores: [
        { id: 0, name: 'Marco',  points: 1000, bank: 3200, locked: false, buzzed: true },
        { id: 1, name: 'Giulia', points: 0,    bank: 5800, locked: true,  buzzed: false },
        { id: 2, name: 'Elia',   points: 1000, bank: 2100, locked: false, buzzed: false }
      ],
      buzzedBy: 0
    }],
    ['main:tripleteBuzzed', { name: 'Marco' }]
  ],

  // 1f · Express: Marco dentro l'express, raffica T O N I
  '1f': (freeze) => {
    const grid = GRIDS[VIAGGI].TONI;
    // Marco è in raffica da quattro lettere: i punti del turno sono i suoi punti
    // express, e nel render valgono 3.500 su una banca da 4.200.
    const scores = [
      { ...PLAYERS[0], roundPoints: 3500, bank: 4200 },
      { ...PLAYERS[1], roundPoints: 0 },
      { ...PLAYERS[2], roundPoints: 0 }
    ];
    const steps = [
      ['main:state', { phase: 'express' }],
      ['main:expressRound', { segments: EXPRESS_SEGMENTS }],
      ['main:gameState', {
        board: { category: 'VIAGGI', grid },
        scores, currentTurn: 0,
        boardNumber: 2, totalBoards: 3, segments: EXPRESS_SEGMENTS,
        expressActive: true, expressValue: 500
      }]
    ];
    // Raffica e occorrenze sono cronaca del turno, non stato: nessun payload le
    // porta. `&freeze=raffica` rigioca le quattro chiamate che le riempiono.
    if (freeze === 'raffica') {
      for (const letter of ['T', 'O', 'N', 'I']) {
        steps.push(['main:letterCalled', { letter }]);
        steps.push(['main:revealLetter', { positions: positionsOf(grid, letter) }]);
      }
    }
    return steps;
  },

  // 1g · Giramoe: moltiplicatore 500, turno di Elia
  '1g': () => [
    ['main:state', { phase: 'giramoe' }],
    ['main:giramoeStart', { segments: GIRAMOE_SEGMENTS }],
    ['main:giramoeBoard', { category: 'GEOGRAFIA', grid: GRIDS[GEOGRAFIA].LRC }],
    ['main:giramoeScores', {
      scores: [
        { id: 0, name: 'Marco',  points: 1000, bank: 7700 },
        { id: 1, name: 'Giulia', points: 500,  bank: 6800 },
        { id: 2, name: 'Elia',   points: 1000, bank: 2100 }
      ],
      currentTurn: 2, multiplier: 500
    }],
    // La finestra è aperta da 2s dei 5: è lo stato del render, non un'animazione
    // di ingresso. `&freeze=finestra` la tiene ferma per lo scatto.
    ['main:giramoeWindow', { ms: 3000, total: 5000, name: 'Elia' }]
  ],

  // 1h · gioco finale, tabellone 1, 42 secondi rimasti
  '1h': () => [
    ['main:state', { phase: 'final' }],
    ['main:finalBoard', {
      category: 'CANZONI ITALIANE', boardIndex: 0, totalBoards: 3,
      finalist: 'Marco', state: 'RUNNING',
      given: ['N', 'R', 'T', 'E'],
      picks: [
        { letter: 'L', present: true }, { letter: 'M', present: true },
        { letter: 'C', present: true }, { letter: 'I', present: true }
      ],
      results: [null, null, null],
      grid: GRIDS[CANZONI].NRTELMCI
    }],
    ['main:finalTimer', { ms: 42000, total: 60000 }]
  ],

  // 1h2 · tabellone 2 del gioco finale: prima e ultima lettera di ogni parola,
  // nessuna scelta. Il handoff non lo disegna: è disegno nostro.
  '1h2': () => [
    ['main:state', { phase: 'final' }],
    ['main:finalBoard', {
      category: 'CANZONI ITALIANE', boardIndex: 1, totalBoards: 3,
      finalist: 'Marco', state: 'RUNNING',
      given: [], picks: [], results: [true, null, null],
      grid: GRIDS[CANZONI].PRIMULT
    }],
    ['main:finalTimer', { ms: 31000, total: 60000 }]
  ],

  // 1h3 · tabellone 3: vuoto, consonanti illimitate, ogni assente costa 3s.
  // `&freeze=penalita` fa arrivare la penalità per fotografare lo scossone.
  '1h3': (freeze) => {
    const steps = [
      ['main:state', { phase: 'final' }],
      ['main:finalBoard', {
        category: 'CANZONI ITALIANE', boardIndex: 2, totalBoards: 3,
        finalist: 'Marco', state: 'RUNNING',
        given: [],
        picks: [
          { letter: 'N', present: true }, { letter: 'S', present: true },
          { letter: 'Z', present: false }, { letter: 'T', present: true },
          { letter: 'B', present: true }, { letter: 'Q', present: false },
          { letter: 'E', present: true }
        ],
        results: [true, false, null],
        grid: GRIDS[CANZONI].NRTELMCI
      }],
      ['main:finalTimer', { ms: 14000, total: 60000 }]
    ];
    if (freeze === 'penalita') steps.push(['main:finalPenalty', { ms: 3000 }]);
    return steps;
  },

  // 1j · buste: la prima verde aperta, una rossa, una verde scambiabile
  '1j': () => [
    ['main:state', { phase: 'envelopes' }],
    ['main:envelopes', ENVELOPES]
  ],

  // finalista · schermata non coperta dal handoff
  finalist: () => [
    ['main:state', { phase: 'finalist' }],
    ['main:finalist', {
      id: 0, name: 'Marco',
      standings: [
        { id: 0, name: 'Marco',  bank: 7700 },
        { id: 1, name: 'Giulia', bank: 6800 },
        { id: 2, name: 'Elia',   bank: 2100 }
      ]
    }]
  ],

  // spareggio · schermata non coperta dal handoff
  tiebreak: () => [
    ['main:state', { phase: 'tiebreak' }],
    ['main:tiebreakStart', {
      segments: GIRAMOE_SEGMENTS,
      contenders: [{ id: 0, name: 'Marco', value: 900 }, { id: 1, name: 'Giulia', value: null }]
    }],
    ['main:tiebreakState', {
      current: 1, currentId: 1,
      contenders: [{ id: 0, name: 'Marco', value: 900 }, { id: 1, name: 'Giulia', value: null }]
    }]
  ]
};

// ==================================================== TELEFONO (play.html)

// Marco è il giocatore 0 in tutti i fixture del telefono
const JOINED = ['player:joined', { playerIndex: 0, name: 'Marco' }];

const PHONE = {
  // 1a · ingresso: nessun payload, è il form
  '1a': () => [],

  // 1b · attesa dell'avvio
  '1b': () => [JOINED],

  // 1c · il tuo turno, deve girare la ruota
  '1c': () => [JOINED, ['player:gameStarted', {}], ['player:turnState', {
    isMyTurn: true, turnState: 'SPIN', roundPoints: 1400, bank: 3200,
    usedLetters: ['N', 'T', 'E'], canBuyVowel: false, currentTurnName: 'Marco'
  }]],

  // 1d · scegli la consonante, spicchio 500
  '1d': () => [JOINED, ['player:gameStarted', {}], ['player:turnState', {
    isMyTurn: true, turnState: 'PICK_CONSONANT', roundPoints: 1400, bank: 3200,
    usedLetters: ['N', 'T', 'E'], canBuyVowel: true, currentTurnName: 'Marco'
  }]],

  // 1e · express: raffica di consonanti
  '1e': () => [JOINED, ['player:gameStarted', {}], ['player:expressRound', {}],
    ['player:turnState', {
      isMyTurn: true, turnState: 'PICK_CONSONANT', roundPoints: 2000, bank: 3200,
      usedLetters: ['T', 'O', 'N', 'I'], canBuyVowel: true, currentTurnName: 'Marco'
    }]],

  // 1f · Triplete, buzzer armato
  '1f': () => [JOINED, ['player:tripleteState', {
    canBuzz: true, buzzedByMe: false, locked: false, state: 'REVEALING',
    message: 'Prenotati appena sai la frase!', points: 1000,
    boardNumber: 1, totalBoards: 3
  }]],

  // 1g · Triplete, bloccato dopo un errore
  '1g': () => [JOINED, ['player:tripleteState', {
    canBuzz: false, buzzedByMe: false, locked: true, state: 'REVEALING',
    message: 'Hai sbagliato — aspetta il prossimo giro', points: 0,
    boardNumber: 1, totalBoards: 3
  }]],

  // 1h · Giramoe, tocca a lui: una sola consonante
  '1h': () => [JOINED, ['player:giramoeState', {
    isMyTurn: true, state: 'PLAYING', canCall: true, canBuyVowel: true, canBuzz: false,
    buzzedByMe: false, points: 1000, multiplier: 500,
    usedLetters: ['L', 'R', 'C'], currentTurnName: 'Marco',
    message: 'Tocca a te: chiama una consonante o compra una vocale'
  }]],

  // 1i · spareggio, tocca a lui girare
  '1i': () => [JOINED, ['player:tiebreakState', {
    isContender: true, canSpin: true, myValue: null,
    message: 'Spareggio! Gira la ruota'
  }]],

  // 1j · esito finalista: vinto
  '1j': () => [JOINED, ['player:finalist', { name: 'Marco', isMe: true }]],

  // 1k · gioco finale: scelta di 3 consonanti + 1 vocale
  '1k': () => [JOINED, ['player:finalStart', { isFinalist: true }],
    ['player:finalState', {
      boardIndex: 0, totalBoards: 3, state: 'PICKING',
      canPickConsonant: true, canPickVowel: true, canBuzz: false,
      usedLetters: ['N', 'R', 'T', 'E'],
      message: 'Scegli 3 consonanti e 1 vocale'
    }]],

  // 1l · buste: ha aperto la prima, può cambiarla una volta
  '1l': () => [JOINED, ['player:envelopesStart', { view: ENVELOPES, isFinalist: true }]]
};

// ======================================================= ADMIN (admin.html)

// Scheletro di adminView(): le chiavi non pertinenti alla fase restano null
const admin = (over) => Object.assign({
  phase: 'lobby', roomCode: 'ABCD',
  players: PLAYERS, boardNumber: 1, totalBoards: 3,
  currentTurn: 0, turnState: 'SPIN',
  triplete: null, giramoe: null, tiebreak: null,
  finalist: null, final: null, envelopes: null
}, over);

const ADMIN = {
  // 1n · pre-partita
  '1n': () => [['admin:state', admin({
    phase: 'pregame',
    players: [], boardNumber: 0, turnState: null
  })]],

  // 1o · lobby, due su tre
  '1o': () => [['admin:state', admin({
    phase: 'lobby',
    players: [{ id: 0, name: 'Marco', connected: true }, { id: 1, name: 'Giulia', connected: true }]
  })]],

  // 1p · partita in corso, turno di Marco
  '1p': () => [['admin:state', admin({ phase: 'playing' })]],

  // 1q · tre tabelloni finiti
  '1q': () => [['admin:state', admin({ phase: 'tripleteReady', boardNumber: 3 })]],

  // 1r · Triplete, setup da compilare
  '1r': () => [['admin:state', admin({
    phase: 'triplete', triplete: { started: false }
  })]],

  // 1s · Triplete live, Marco prenotato
  '1s': () => [['admin:state', admin({
    phase: 'triplete',
    triplete: {
      started: true, title: 'SAGGEZZA POPOLARE', boardNumber: 1, totalBoards: 3,
      state: 'BUZZED', buzzedBy: 0,
      players: [
        { id: 0, name: 'Marco',  points: 1000, bank: 3200, locked: false, buzzed: true },
        { id: 1, name: 'Giulia', points: 0,    bank: 5800, locked: true,  buzzed: false },
        { id: 2, name: 'Elia',   points: 1000, bank: 2100, locked: false, buzzed: false }
      ]
    }
  })]],

  // 1t · Giramoe, moltiplicatore già uscito
  '1t': () => [['admin:state', admin({
    phase: 'giramoe',
    giramoe: {
      started: true, category: 'GEOGRAFIA', multiplier: 500, state: 'PLAYING',
      currentTurn: 2, buzzedBy: null, currentName: 'Elia',
      players: [
        { id: 0, name: 'Marco',  points: 1000, bank: 7700 },
        { id: 1, name: 'Giulia', points: 500,  bank: 6800 },
        { id: 2, name: 'Elia',   points: 1000, bank: 2100 }
      ]
    }
  })]],

  // 1u · spareggio in corso
  '1u': () => [['admin:state', admin({
    phase: 'tiebreak',
    tiebreak: {
      current: 1, currentId: 1,
      contenders: [{ id: 0, name: 'Marco', value: 900 }, { id: 1, name: 'Giulia', value: null }]
    }
  })]],

  // 1v · finalista + setup del gioco finale
  '1v': () => [['admin:state', admin({
    phase: 'finalist', finalist: { id: 0, name: 'Marco' }
  })]],

  // 1w · gioco finale live, tabellone 1, 42s
  '1w': () => [['admin:state', admin({
    phase: 'final', finalist: { id: 0, name: 'Marco' },
    final: {
      category: 'CANZONI ITALIANE', boardIndex: 0, totalBoards: 3,
      state: 'RUNNING', results: [null, null, null], timeLeft: 42000, buzzed: false
    }
  })]],

  // 1x · buste: due verdi, una rossa da rivelare
  '1x': () => [['admin:state', admin({
    phase: 'envelopes', finalist: { id: 0, name: 'Marco' }, envelopes: ENVELOPES
  })]]
};

export const BY_SURFACE = { tv: TV, phone: PHONE, admin: ADMIN };

export function sequenceFor(surface, screen, freeze) {
  const build = (BY_SURFACE[surface] || {})[screen];
  return build ? build(freeze) : null;
}

// elenco degli id disponibili, comodo dalla console: __mockScreens()
// (il guard serve perché tests/fixtures.test.js importa questo modulo in Node)
if (typeof window !== 'undefined') {
  window.__mockScreens = () => Object.fromEntries(
    Object.entries(BY_SURFACE).map(([k, v]) => [k, Object.keys(v)]));
}
