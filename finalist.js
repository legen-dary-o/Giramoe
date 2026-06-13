// Finalist selection after the GIRAMOE board: whoever has the most bank advances to
// the final game alone. Ties are broken by a wheel spin among the tied players
// (highest value wins, those points NOT added); still tied -> sudden death. Pure
// helpers — the spin orchestration lives in server.js.

// Ids of the players holding the highest bank (one id = clear finalist).
function topPlayers(players) {
  const max = Math.max(...players.map(p => p.bank));
  return players.filter(p => p.bank === max).map(p => p.id);
}

// Given a spin value per contender, return { winner } or { tied: [ids] } for the
// highest spin. `spins` is a map of playerId -> value.
function evaluateSpins(contenders, spins) {
  const max = Math.max(...contenders.map(id => spins[id]));
  const top = contenders.filter(id => spins[id] === max);
  return top.length === 1 ? { winner: top[0] } : { tied: top };
}

module.exports = { topPlayers, evaluateSpins };
