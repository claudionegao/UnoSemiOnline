import { Server } from 'socket.io';
const { initGame, drawCards, playCard } = require('../../lib/game');

const games = new Map(); // roomCode -> { state, players: Map<socketId, playerId> }

function makeCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function handler(req, res) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server, { path: '/api/socket' });
    res.socket.server.io = io;

    io.on('connection', socket => {
      socket.on('create_room', (cb) => {
        const code = makeCode();
        games.set(code, { players: new Map(), state: null });
        socket.join(code);
        socket.emit('created', { code });
        if (cb) cb({ code });
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
        // initialize game state
        room.state = initGame(playerIds || Array.from(room.players.values()));
        io.to(code).emit('state_update', room.state);
        if (cb) cb({ ok: true });
      });

      socket.on('play_card', ({ code, playerId, card, chosenColor }, cb) => {
        const room = games.get(code);
        if (!room || !room.state) return cb && cb({ error: 'no game' });
        try {
          const result = playCard(room.state, playerId, card, chosenColor);
          // quando jogo uma carta que não é de compra, e havia pendingDraw, isso é proibido no playCard (lança)
          io.to(code).emit('state_update', room.state);
          // verificar UNO: jogador com 1 carta
          const owner = room.state.players.find(p => p.id === playerId && p.hand.length === 1);
          if (owner) {
            // avisar a sala que este jogador está em UNO
            io.to(code).emit('uno_alert', { ownerId: owner.id });
            room.unoAlert = { ownerId: owner.id, timestamp: Date.now(), resolved: false };
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
        if (!room || !room.state) return cb && cb({ error: 'no game' });
        const alert = room.unoAlert;
        if (!alert || alert.resolved) return cb && cb({ error: 'no uno alert' });
        const ownerId = alert.ownerId;
        if (pressedBy === ownerId) {
          // owner pressed their own uno (valid) -> resolve without penalty
          alert.resolved = true;
          io.to(code).emit('uno_resolved', { ownerId, by: pressedBy, penalty: false });
          return cb && cb({ ok: true });
        }
        // another player pressed first -> owner compra 2
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
