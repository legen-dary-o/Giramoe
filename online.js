// Avvia Giramoe esposto su internet tramite un tunnel Cloudflare (cloudflared).
// Uso: npm run online
//
// Apre cloudflared, cattura l'URL pubblico e lancia il server con quell'URL nel QR.
// Admin e schermo principale sono raggiungibili ANCHE via tunnel, così nessuno
// (nemmeno tu) deve stare sulla stessa rete Wi-Fi.
const { spawn } = require('child_process');

const TUNNEL_TIMEOUT_MS = 25000;
let tunnelStarted = false;

console.log('Giramoe — modalità ONLINE');

// 1. BINDING IMMEDIATO: Avviamo SUBITO il server locale sulla porta 3000
// In questo modo la porta 3000 è occupata e Safari/Cloudflare la troveranno attiva.
console.log('Avvio il server locale...');
const server = require('./server');

console.log('Apro il tunnel Cloudflare (attendi ~10 secondi)...\n');

let tunnel;
try {
  tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://127.0.0.1:3000']); // Usiamo 127.0.0.1 per evitare i capricci di localhost
} catch (e) {
  banner(null);
}

function banner(publicUrl) {
  const line = '═'.repeat(58);
  if (publicUrl) {
    console.log('\n' + line);
    console.log('  TUNNEL ATTIVO — apri questi link da QUALSIASI rete:');
    console.log('');
    console.log(`  • Schermo (sul PC):  http://127.0.0.1:3000`);
    console.log(`  • Admin (telefono):  ${publicUrl}/admin.html`);
    console.log(`  • Giocatori:         inquadrano il QR (già puntato al tunnel)`);
    console.log('');
    console.log('  Tieni questa finestra aperta. Ctrl+C per fermare.');
    console.log(line + '\n');
  } else {
    console.log('\n' + line);
    console.log('  ⚠  Tunnel non disponibile → modalità LOCALE (stesso Wi-Fi).');
    console.log('     Apri lo schermo e l\'admin dagli indirizzi locali.');
    console.log(line + '\n');
  }
}

function handleTunnelUrl(publicUrl) {
  if (tunnelStarted) return;
  tunnelStarted = true;

  // Se il tuo server.js ha bisogno dell'URL dinamico per generare il QR code, 
  // assicurati che server.js sia in grado di leggere process.env.GIRAMOE_PUBLIC_URL 
  // anche se è già stato avviato, oppure passaglielo dinamicamente.
  if (publicUrl) {
    process.env.GIRAMOE_PUBLIC_URL = publicUrl;
    // Se server.js ha una funzione per aggiornare il QR, chiamala qui. Ex: server.updateQR(publicUrl);
  }
  banner(publicUrl);
}

function onOutput(chunk) {
  const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) handleTunnelUrl(match[0]);
}

if (tunnel) {
  tunnel.stdout.on('data', onOutput);
  tunnel.stderr.on('data', onOutput);
  tunnel.on('error', () => {
    console.error('cloudflared non trovato. Installalo una volta con:  brew install cloudflared');
    banner(null);
  });
}

setTimeout(() => {
  if (!tunnelStarted) {
    console.warn('Il tunnel ci sta mettendo troppo, continuo in modalità locale.\n');
    banner(null);
  }
}, TUNNEL_TIMEOUT_MS);

function shutdown() {
  try { if (tunnel) tunnel.kill(); } catch (e) { }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);