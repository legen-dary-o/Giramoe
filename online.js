// Avvia Giramoe esposto su internet tramite un tunnel Cloudflare (cloudflared).
// Uso: npm run online
// Avvia cloudflared, cattura l'URL pubblico e lancia il server con quell'URL
// nel QR, così i giocatori possono entrare da qualsiasi rete.
const { spawn } = require('child_process');

console.log('Avvio del tunnel Cloudflare...');

const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000']);
let started = false;

function onOutput(chunk) {
  const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !started) {
    started = true;
    process.env.GIRAMOE_PUBLIC_URL = match[0];
    console.log(`Tunnel attivo: ${match[0]}`);
    require('./server');
  }
}

tunnel.stdout.on('data', onOutput);
tunnel.stderr.on('data', onOutput);

tunnel.on('error', () => {
  console.error('cloudflared non trovato. Installalo con: brew install cloudflared');
  process.exit(1);
});

tunnel.on('exit', (code) => {
  if (!started) {
    console.error(`Il tunnel si è chiuso prima di partire (codice ${code}). Riprova.`);
    process.exit(1);
  }
});

function shutdown() {
  tunnel.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
