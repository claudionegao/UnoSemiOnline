import { Server } from 'socket.io';
const { initGame, drawCards, playCard } = require('../../lib/game');

const games = new Map(); // roomCode -> { state, players: Map<socketId, playerId>, owner, unoAlert, unoTimer, winner, logs: [] }

// expose games map for read-only inspection via other API routes
global.unoGames = games;

const UNO_TIMEOUT = 7000; // ms before UNO alert expires without penalty

function makeCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function handler(req, res) {
  // On serverless platforms like Vercel, starting a persistent Socket.IO server
  // inside an API route is not supported. Detect Vercel and skip initialization
  // so the function doesn't attempt to create a long-lived server there.
  if (process.env.VERCEL) {
    console.log('[socket] running on Vercel - socket server disabled in this environment');
    res.statusCode = 501;
    res.end('Socket server disabled on serverless platform.');
    return;
  }

  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, { path: '/api/socket' });
    res.socket.server.io = io;

    io.on('connection', socket => {
      socket.on('create_room', (cb) => {
        const code = makeCode();
        games.set(code, { players: new Map(), state: null, owner: socket.id, unoAlert: null, unoTimer: null, winner: null, logs: [] });
        socket.join(code);
        socket.emit('created', { code });
        if (cb) cb({ code });
      });

      // receive logs from clients for server-side storage and debugging
      socket.on('client_log', ({ code, level = 'info', msg = '', meta = {} }) => {
        try {
          const room = games.get(code);
          const entry = { ts: Date.now(), from: socket.id, level, msg, meta };
          if (room) {
            room.logs = room.logs || [];
            room.logs.push(entry);
          }
          console.log(`[client_log][${code}]`, level, msg, meta);
        } catch (e) {
          console.log('[client_log] failed to store log', e && e.message);
        }
      });

      socket.on('join_room', ({ code, playerId, name }, cb) => {
        const room = games.get(code);
        if (!room) return cb && cb({ error: 'room not found' });
        room.players.set(socket.id, playerId || socket.id);
        socket.join(code);
        io.to(code).emit('player_joined', { players: Array.from(room.players.values()) });
        if (cb) cb({ ok: true });
      });

      socket.on('start_game', ({ code, playerIds }, cb) => {
        const room = games.get(code);
        if (!room) return cb && cb({ error: 'room not found' });
        // only the room owner (main/table) or the first connected player can start a game
        const firstSocketId = room.players && room.players.size ? Array.from(room.players.keys())[0] : null;
        if (room.owner && socket.id !== room.owner && socket.id !== firstSocketId) return cb && cb({ error: 'only room owner or first player can start the game' });
        // don't start if a game is already active
        if (room.state) return cb && cb({ error: 'game already in progress' });
        // initialize game state (derive players from room.players by default)
        const ids = playerIds && playerIds.length ? playerIds : Array.from(room.players.values());
        room.state = initGame(ids);
        // log initial top card for debugging / verification
        try {
          const top = room.state && room.state.discard && room.state.discard[room.state.discard.length - 1];
          console.log(`[start_game] room=${code} initial_top=`, top);
          // emit initial top card so test clients can observe it
          io.to(code).emit('initial_top', top);
        } catch (e) {
          console.log('[start_game] failed to log initial top', e && e.message);
        }
        room.winner = null;
        room.unoAlert = null;
        if (room.unoTimer) { clearTimeout(room.unoTimer); room.unoTimer = null; }
        io.to(code).emit('state_update', room.state);
        if (cb) cb({ ok: true });
      });

      socket.on('play_card', ({ code, playerId, card, chosenColor }, cb) => {
        const room = games.get(code);
        if (!room || !room.state) return cb && cb({ error: 'no game' });
        try {
          const result = playCard(room.state, playerId, card, chosenColor);
          io.to(code).emit('state_update', room.state);

          // verificar UNO: jogador com 1 carta
          const owner = room.state.players.find(p => p.id === playerId && p.hand.length === 1);
          if (owner) {
            // avisar a sala que este jogador está em UNO
            io.to(code).emit('uno_alert', { ownerId: owner.id });
            // setup server-side uno alert with timeout
            room.unoAlert = { ownerId: owner.id, timestamp: Date.now(), resolved: false };
            if (room.unoTimer) { clearTimeout(room.unoTimer); room.unoTimer = null; }
            room.unoTimer = setTimeout(() => {
              // if still unresolved after timeout, resolve without penalty
              if (room.unoAlert && !room.unoAlert.resolved) {
                room.unoAlert.resolved = true;
                io.to(code).emit('uno_resolved', { ownerId: owner.id, by: null, penalty: false });
                room.unoTimer = null;
              }
            }, UNO_TIMEOUT);
          }

          // verificar vitória: jogador sem cartas
          const winner = room.state.players.find(p => p.hand.length === 0);
          if (winner) {
            room.winner = winner.id;
            io.to(code).emit('game_over', { winnerId: winner.id });
            // cleanup: end current game so a new one can only be iniciado pela tela principal (owner)
            room.state = null;
            room.pending = null;
            if (room.unoTimer) { clearTimeout(room.unoTimer); room.unoTimer = null; }
          }

          if (cb) cb({ ok: true });
        } catch (err) {
          if (cb) cb({ error: err.message });
        }
      });

      socket.on('draw_card', ({ code, playerId, count }, cb) => {
        const room = games.get(code);
        if (!room || !room.state) return cb && cb({ error: 'no game' });
        const pending = room.state.pendingDraw || { type: null, amount: 0 };
        if (pending.amount > 0 && (!count || count === 0)) {
          // jogador está resolvendo uma penalidade: desenha o total pendente e perde a vez
          const cards = drawCards(room.state, playerId, pending.amount);
          room.state.pendingDraw = { type: null, amount: 0 };
          // avançar a vez após aplicar penalidade
          // ensure current points to the player who was penalized, then move to next
          // find index of playerId
          const idx = room.state.players.findIndex(p => p.id === playerId);
          if (idx !== -1) room.state.current = idx;
          // move to next
          room.state.current = (room.state.current + room.state.direction + room.state.players.length) % room.state.players.length;
          io.to(code).emit('state_update', room.state);
          if (cb) cb({ cards });
        } else {
          // draw normal count (default 1)
          const cards = drawCards(room.state, playerId, count || 1);
          // advance the turn only if the drawer was the current player
          const idx = room.state.players.findIndex(p => p.id === playerId);
          const priorCurrent = room.state.current;
          if (idx !== -1 && priorCurrent === idx) {
            room.state.current = (room.state.current + room.state.direction + room.state.players.length) % room.state.players.length;
          }
          io.to(code).emit('state_update', room.state);
          if (cb) cb({ cards });
        }
      });

      socket.on('get_state', ({ code }, cb) => {
        const room = games.get(code);
        if (!room) return cb && cb({ error: 'room not found' });
        cb && cb({ state: room.state });
      });

      socket.on('press_uno', ({ code, pressedBy }, cb) => {
        const room = games.get(code);
        if (!room) return cb && cb({ error: 'room not found' });
        const alert = room.unoAlert;
        if (!alert || alert.resolved) return cb && cb({ error: 'no uno alert' });
        const ownerId = alert.ownerId;
        // cancel server timeout
        if (room.unoTimer) { clearTimeout(room.unoTimer); room.unoTimer = null; }
        if (pressedBy === ownerId) {
          // owner pressed their own uno (valid) -> resolve without penalty
          alert.resolved = true;
          io.to(code).emit('uno_resolved', { ownerId, by: pressedBy, penalty: false });
          return cb && cb({ ok: true });
        }
        // another player pressed first -> owner compra 2
        if (!room.state) {
          // if game already ended, nothing to do
          alert.resolved = true;
          return cb && cb({ error: 'no game' });
        }
        const cards = drawCards(room.state, ownerId, 2);
        alert.resolved = true;
        io.to(code).emit('state_update', room.state);
        io.to(code).emit('uno_resolved', { ownerId, by: pressedBy, penalty: true, cards });
        return cb && cb({ ok: true });
      });

      socket.on('disconnecting', () => {
        for (const code of Object.keys(socket.rooms)) {
          // nothing for now
        }
      });
    });
  }
  res.end();
}
