// Avvia Giramoe esposto su internet tramite un tunnel Cloudflare (cloudflared).
// Uso: npm run online
//
// Apre cloudflared, cattura l'URL pubblico e lancia il server con quell'URL nel QR.
// Admin e schermo principale sono raggiungibili ANCHE via tunnel, così nessuno
// (nemmeno tu) deve stare sulla stessa rete Wi-Fi.
const { spawn } = require('child_process');

const TUNNEL_TIMEOUT_MS = 25000;
let started = false;

console.log('Giramoe — modalità ONLINE');
console.log('Apro il tunnel Cloudflare (attendi ~10 secondi)...\n');

let tunnel;
try {
  tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000']);
} catch (e) {
  startServer(null);
}

function banner(publicUrl) {
  const line = '═'.repeat(58);
  if (publicUrl) {
    console.log('\n' + line);
    console.log('  TUNNEL ATTIVO — apri questi link da QUALSIASI rete:');
    console.log('');
    console.log(`  • Schermo (sul PC):  http://localhost:3000`);
    console.log(`  • Admin (telefono):  ${publicUrl}/admin.html`);
    console.log(`  • Giocatori:         inquadrano il QR (già puntato al tunnel)`);
    console.log('');
    console.log('  Tieni questa finestra aperta. Ctrl+C per fermare.');
    console.log(line + '\n');
  } else {
    console.log('\n' + line);
    console.log('  ⚠  Tunnel non disponibile → modalità LOCALE (stesso Wi-Fi).');
    console.log('     La tua rete potrebbe bloccare i tunnel Cloudflare.');
    console.log('     Apri lo schermo e l\'admin dagli indirizzi qui sotto.');
    console.log(line + '\n');
  }
}

function startServer(publicUrl) {
  if (started) return;
  started = true;
  if (publicUrl) process.env.GIRAMOE_PUBLIC_URL = publicUrl;
  banner(publicUrl);
  require('./server');
}

function onOutput(chunk) {
  const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) startServer(match[0]);
}

if (tunnel) {
  tunnel.stdout.on('data', onOutput);
  tunnel.stderr.on('data', onOutput);
  tunnel.on('error', () => {
    console.error('cloudflared non trovato. Installalo una volta con:  brew install cloudflared');
    console.error('Oppure usa "npm start" per giocare sulla stessa rete Wi-Fi.\n');
    startServer(null);
  });
}

// Se il tunnel non produce un URL entro il timeout, parti comunque in locale.
setTimeout(() => {
  if (!started) {
    console.warn('Il tunnel non è pronto in tempo, parto in locale.\n');
    startServer(null);
  }
}, TUNNEL_TIMEOUT_MS);

function shutdown() {
  try { if (tunnel) tunnel.kill(); } catch (e) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
