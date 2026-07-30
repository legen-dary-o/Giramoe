// SAMIRO — base di conoscenza (solo regolamento di Giramoe).
// Ogni voce: q = domanda mostrata, a = risposta, k = parole chiave per il matching.
// Modifica liberamente i contenuti qui: la logica sta in samiro.js.
// Fonte: docs/samiro-regolamento.md

const SAMIRO_INTRO = 'Ciao, sono Samiro, il tuo assistente! Come posso aiutarti? 🦄';

const SAMIRO_FALLBACK =
  'Questo non lo trovo nel regolamento 🤔 Prova a chiedermelo in altro modo, oppure chiedi all’admin.';

// Easter eggs: risposte speciali con priorità sul matching normale.
const SAMIRO_NO_HINT =
  'Mi dispiace, non posso fornirti la soluzione o indizi: sono costretto a segnalarti a Shabban.';
const SAMIRO_MOE = 'Il capo assoluto.';
const SAMIRO_OPAL = 'Martina stai zitta!';

const SAMIRO_FAQ = [
  // --- Generale ---
  {
    q: 'Come si gioca? Quante fasi ci sono?',
    a: 'Il gioco ha sei fasi: 1) La Ruota (3 tabelloni), 2) Il Triplete, 3) L’Express, 4) Giramoe, 5) La Finale, 6) Le Buste.',
    k: ['come si gioca', 'quante fasi', 'fasi', 'struttura', 'regole', 'panoramica']
  },
  {
    q: 'Che differenza c’è tra Turno e Banca?',
    a: 'I punti si accumulano nel Turno e restano con te per tutto il tabellone, anche se passi il turno o sbagli. Passano in Banca solo quando risolvi la frase. Se il tabellone lo risolve un altro giocatore non incassi i tuoi punti del turno; la Bancarotta invece li azzera insieme alla banca. La classifica per la finale conta i punti in Banca.',
    k: ['turno', 'banca', 'differenza turno banca', 'punti banca', 'classifica', 'accumulo punti']
  },

  // --- Fase 1: La Ruota ---
  {
    q: 'Come funziona la prima fase (la Ruota)?',
    a: 'Ci sono 3 tabelloni, ognuno con un argomento diverso. A turno giri la ruota e chiami una consonante, oppure provi a dire la frase.',
    k: ['prima fase', 'ruota', 'tabelloni', 'come funziona ruota', 'fase uno', 'girare la ruota']
  },
  {
    q: 'Come si guadagnano punti? Quanto vale una consonante?',
    a: 'Dopo aver girato chiami una consonante: vale il valore girato × quante volte compare nel tabellone. Se non c’è, passi il turno.',
    k: ['guadagnare punti', 'quanto vale consonante', 'valore consonante', 'punti consonante', 'punti lettera']
  },
  {
    q: 'Posso dire la frase? Quando dico la soluzione?',
    a: 'Sì, nel tuo turno puoi dire la frase in qualsiasi momento, anche subito dopo aver chiamato una consonante. Se è giusta incassi i punti del turno in banca; se sbagli, passi il turno.',
    k: ['dire la frase', 'soluzione', 'risolvere', 'indovinare', 'quando dico frase']
  },
  {
    q: 'Come compro una vocale? Quanto costa?',
    a: 'La vocale costa 500 punti. Puoi comprarla solo dopo aver già preso almeno una consonante in questo turno e se hai almeno 500 punti. La vocale viene solo rivelata (non dà punti); se non è nel tabellone, passi il turno.',
    k: ['comprare vocale', 'compro vocale', 'vocale', 'costo vocale', '500', 'quanto costa vocale']
  },
  {
    q: 'Cos’è la Bancarotta?',
    a: 'Uno spicchio speciale della ruota: perdi tutti i punti, sia quelli del turno che quelli in banca, e passi il turno.',
    k: ['bancarotta', 'perdo tutti i punti', 'spicchio bancarotta', 'perdere punti']
  },
  {
    q: 'Cosa fa lo spicchio Passa?',
    a: 'Passa il turno al giocatore successivo.',
    k: ['passa', 'passa il turno', 'spicchio passa']
  },
  {
    q: 'Cosa fa lo spicchio Raddoppia?',
    a: 'Se ci capiti devi poi chiamare una consonante: se è presente nel tabellone i punti del tuo turno raddoppiano. Se la consonante non c’è, passi il turno.',
    k: ['raddoppia', 'raddoppio', 'doppio', 'spicchio raddoppia']
  },
  {
    q: 'Cosa succede se sbaglio la frase o chiamo una lettera che non c’è?',
    a: 'Il turno passa al giocatore successivo, ma i punti che hai accumulato nel turno restano tuoi: li ritrovi al tuo prossimo turno su questo tabellone. Li incassi in banca solo se risolvi la frase; li perdi se il tabellone lo risolve un altro giocatore (o se fai bancarotta).',
    k: ['sbaglio frase', 'lettera che non c’è', 'lettera assente', 'errore', 'sbagliare', 'lettera mancante', 'perdo i punti']
  },

  // --- Fase 2: Triplete ---
  {
    q: 'Come funziona il Triplete?',
    a: 'Tre tabelloni sullo stesso argomento. Qui non si gira la ruota né si comprano lettere: le lettere appaiono da sole e ci si prenota quando si pensa di sapere la frase.',
    k: ['triplete', 'seconda fase', 'come funziona triplete', 'fase due', 'prenotarsi triplete']
  },
  {
    q: 'Quanto vale il Triplete? Quanti punti dà?',
    a: 'Ogni tabellone risolto vale 1000 punti. Se lo stesso giocatore li risolve tutti e 3 (cappotto), scatta a 5000 punti.',
    k: ['quanto vale triplete', 'punti triplete', 'cappotto', '5000', '1000', 'quanti punti triplete', 'tre tabelloni', 'tutti e tre i tabelloni', 'tutti i tabelloni', 'tabelloni triplete']
  },
  {
    q: 'Cosa succede se mi prenoto e sbaglio nel Triplete?',
    a: 'Vieni bloccato per quel tabellone: non puoi riprenotarti finché anche gli altri due giocatori non sbagliano. Quando tutti hanno sbagliato, i blocchi si azzerano.',
    k: ['prenoto e sbaglio', 'bloccato triplete', 'riprenotarsi', 'lockout', 'prenotazione sbagliata']
  },
  {
    q: 'Perché nel terzo tabellone del Triplete le lettere spariscono?',
    a: 'Nei primi due le lettere appaiono e restano. Nel terzo all’inizio appaiono e scompaiono, poi cominciano a fermarsi: chi riesce a memorizzarle ha un grosso vantaggio.',
    k: ['terzo tabellone triplete', 'lettere spariscono', 'lettere appaiono scompaiono', 'memoria', 'flash']
  },

  // --- Fase 3: Express ---
  {
    q: 'Come funziona l’Express?',
    a: 'Come la prima fase, ma la ruota ha uno spicchio in più: L’Express.',
    k: ['express', 'terza fase', 'come funziona express', 'fase tre']
  },
  {
    q: 'Cosa succede se capito sullo spicchio Express?',
    a: 'Puoi chiamare tutte le consonanti e comprare tutte le vocali che vuoi senza rigirare la ruota, purché siano presenti nel tabellone. Ogni consonante presente vale 500 × occorrenze; le vocali costano 500 e vengono solo rivelate.',
    k: ['spicchio express', 'capito su express', 'tutte le consonanti', 'senza girare', 'come funziona spicchio express']
  },
  {
    q: 'Cosa succede se in Express chiamo una lettera che non c’è o sbaglio la frase?',
    a: 'Vai in bancarotta (perdi turno e banca) e si passa al giocatore successivo, che torna a girare la ruota normalmente.',
    k: ['express lettera assente', 'express bancarotta', 'express sbaglio', 'sbaglio in express']
  },

  // --- Fase 4: Giramoe ---
  {
    q: 'Come funziona la fase Giramoe?',
    a: 'L’admin (Moe) gira una ruota che ha solo punteggi: il valore ottenuto diventa il moltiplicatore. Poi i giocatori a turno fanno una sola mossa ciascuno: chiamano una consonante — ogni consonante presente vale quel moltiplicatore × le sue occorrenze — oppure comprano una vocale a 500 punti. Comprare la vocale esclude la consonante per quel turno, e viceversa.',
    k: ['giramoe', 'quarta fase', 'moltiplicatore', 'moe', 'come funziona giramoe', 'fase quattro']
  },
  {
    q: 'In Giramoe come ci si prenota per rispondere?',
    a: 'Dopo aver chiamato una consonante presente o comprato una vocale presente hai pochi secondi (5) per prenotarti e dire la frase. Se la lettera è assente niente prenotazione e passi il turno. Quando tutte le consonanti sono state rivelate ti puoi prenotare subito, senza chiamare né comprare nulla.',
    k: ['giramoe prenotarsi', 'giramoe 5 secondi', 'giramoe rispondere', 'prenotarsi giramoe', 'secondi giramoe']
  },
  {
    q: 'In Giramoe si possono comprare le vocali?',
    a: 'Sì, costano 500 punti come sempre, scalati dai punti che hai già accumulato nel Giramoe nei turni precedenti. Comprare la vocale è tutta la tua mossa del turno: nello stesso turno non puoi anche chiamare una consonante, e ne compri una sola. La vocale viene solo rivelata e non dà punti, ma apre la prenotazione. Se non è nel tabellone i 500 sono persi e passi il turno — e quella vocale resta comprabile da chiunque, come le consonanti assenti.',
    k: ['giramoe vocali', 'comprare vocale giramoe', 'vocale giramoe', 'giramoe 500', 'più vocali giramoe', 'due vocali giramoe']
  },
  {
    q: 'In Giramoe chi incassa i punti?',
    a: 'Solo il giocatore che risolve la frase incassa in banca i punti che ha accumulato. Tutti gli altri non incassano nulla.',
    k: ['giramoe chi incassa', 'giramoe punti', 'chi prende i punti giramoe', 'incassare giramoe']
  },

  // --- Fase 5: Finale ---
  {
    q: 'Chi va in finale?',
    a: 'Il giocatore con più punti in Banca. In caso di pareggio si fa uno spareggio alla ruota: vince chi gira il valore più alto (senza aggiungere quei punti). Se anche lo spareggio finisce in parità, si ripete tra i soli giocatori ancora pari finché non resta un unico finalista. In finale ci va sempre un solo giocatore.',
    k: ['chi va in finale', 'chi passa alla finale', 'passa alla finale', 'va in finale', 'accede alla finale', 'arriva in finale', 'finalista', 'più punti', 'pareggio', 'spareggio', 'sudden death', 'parità']
  },
  {
    q: 'Come funziona la Finale?',
    a: 'Il finalista gioca da solo su 3 tabelloni sullo stesso argomento, con un unico tempo totale di 60 secondi per tutti e tre. Ogni tabellone risolto diventa verde.',
    k: ['come funziona la finale', 'finale', '60 secondi', 'tempo finale', 'quinta fase', 'gioco finale', 'timer finale']
  },
  {
    q: 'Come funziona il primo tabellone della finale?',
    a: 'Compaiono le lettere N R T E più 3 consonanti e 1 vocale a tua scelta. Girate le lettere, parte il timer: puoi prenotarti e rispondere, oppure dire “passo” perdendo il tabellone.',
    k: ['primo tabellone finale', 'nrte', 'lettere finale', '3 consonanti', 'passo', 'dire passo', 'posso passare']
  },
  {
    q: 'Come funziona il secondo tabellone della finale?',
    a: 'Compaiono solo la prima e l’ultima lettera di ogni parola. Poi funziona come il primo: ti prenoti e rispondi, o passi.',
    k: ['secondo tabellone finale', 'prima e ultima lettera', 'prima ultima lettera']
  },
  {
    q: 'Come funziona il terzo tabellone della finale?',
    a: 'Puoi chiamare consonanti illimitate e 1 vocale, ma per ogni lettera sbagliata vengono tolti 3 secondi dal tempo.',
    k: ['terzo tabellone finale', 'consonanti illimitate', 'meno 3 secondi', 'penalità tempo', 'lettera sbagliata finale']
  },

  // --- Fase 6: Buste ---
  {
    q: 'Come funzionano le buste?',
    a: 'A ogni tabellone risolto nella finale corrisponde una busta verde con un premio dentro. Le buste dei tabelloni non risolti sono rosse e le apre solo l’admin.',
    k: ['buste', 'sesta fase', 'premio', 'busta verde', 'busta rossa', 'come funzionano le buste', 'fase sei']
  },
  {
    q: 'Posso cambiare la busta?',
    a: 'Sì: se hai più di una busta verde disponibile puoi aprirne una e poi cambiarla con un’altra verde a tua scelta. Ma una busta lasciata non può più essere ripresa.',
    k: ['cambiare busta', 'cambio busta', 'scegliere busta', 'tornare indietro busta']
  }
];

// Domande frequenti mostrate come bolle da toccare all'apertura della chat.
// Ogni voce usa il testo esatto di una domanda sopra, così il match è garantito.
const SAMIRO_QUICK = [
  'Come si gioca? Quante fasi ci sono?',
  'Come compro una vocale? Quanto costa?',
  'Cos’è la Bancarotta?',
  'Come funziona il Triplete?',
  'Chi va in finale?',
  'Come funzionano le buste?'
];
