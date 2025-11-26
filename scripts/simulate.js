const io = require('socket.io-client');

const SERVER = 'http://localhost:3000';
const PATH = '/api/socket';

function canPlay(card, topCard, pending) {
  if (!card) return false;
  if (card.type === 'wild' || card.type === 'wild_draw4') return true;
  if (!topCard) return true;
  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
  if (card.color && topCard.color && card.color === topCard.color) return true;
  if (card.type === topCard.type && card.type !== 'number') return true;
  // if there's pending draw, only same type allowed
  if (pending && pending.amount > 0) {
    return card.type === pending.type;
  }
  return false;
}

function makeClient(name) {
  const socket = io(SERVER, { path: PATH, reconnection: false });
  socket.name = name;
  socket.playerId = name;
  socket.ready = false;
  socket.state = null;
  socket.on('connect', () => console.log(`${name}: connected`));
  socket.on('disconnect', () => console.log(`${name}: disconnected`));
  socket.on('state_update', (st) => {
    socket.state = st;
    //console.log(`${name}: state_update`);
    handleTurn(socket);
  });
  socket.on('initial_top', (top) => console.log(`${name}: initial_top`, top));
  socket.on('uno_alert', (info) => console.log(`${name}: UNO alert for ${info.ownerId}`));
  socket.on('uno_resolved', (info) => console.log(`${name}: UNO resolved`, info));
  socket.on('game_over', (info) => console.log(`${name}: GAME OVER`, info));
  return socket;
}

function handleTurn(socket) {
  const st = socket.state;
  if (!st) return;
  const me = st.players.find(p => p.id === socket.playerId);
  if (!me) return;
  const myIdx = st.players.findIndex(p => p.id === socket.playerId);
  const isMyTurn = myIdx === st.current;
  if (!isMyTurn) return;

  // pending draw handling
  const pending = st.pendingDraw || { type: null, amount: 0 };
  if (pending.amount > 0) {
    // try to stack
    const stackable = me.hand.find(c => c.type === pending.type);
    if (stackable) {
      console.log(`${socket.playerId}: stacking ${stackable.type}`);
      socket.emit('play_card', { code: currentCode, playerId: socket.playerId, card: stackable }, (res) => {
        if (res && res.error) console.log(`${socket.playerId}: play error`, res.error);
      });
      return;
    }
    // accept penalty
    console.log(`${socket.playerId}: accepting penalty of ${pending.amount}`);
    socket.emit('draw_card', { code: currentCode, playerId: socket.playerId, count: 0 }, (res) => {
      if (res && res.cards) console.log(`${socket.playerId}: drew ${res.cards.length} penalty cards`);
    });
    return;
  }

  // normal play: try playable card
  const top = st.discard && st.discard[st.discard.length - 1];
  const playable = me.hand.find(c => canPlay(c, top, pending));
  if (playable) {
    console.log(`${socket.playerId}: playing`, playable.type === 'number' ? playable.value : playable.type);
    const chosenColor = (playable.type === 'wild' || playable.type === 'wild_draw4') ? 'red' : undefined;
    socket.emit('play_card', { code: currentCode, playerId: socket.playerId, card: playable, chosenColor }, (res) => {
      if (res && res.error) console.log(`${socket.playerId}: play error`, res.error);
    });
    return;
  }

  // nothing playable: draw
  console.log(`${socket.playerId}: drawing a card`);
  socket.emit('draw_card', { code: currentCode, playerId: socket.playerId, count: 1 }, (res) => {
    if (res && res.cards) console.log(`${socket.playerId}: drew ${res.cards.length} cards`);
  });
}

let clientA, clientB;
let currentCode;

async function run() {
  clientA = makeClient('A');
  clientB = makeClient('B');

  // wait for connects
  await sleep(500);

  // A creates room
  clientA.emit('create_room', (res) => {
    currentCode = res.code;
    console.log('Room created', currentCode);

    // A join
    clientA.emit('join_room', { code: currentCode, playerId: 'A', name: 'A' }, (r) => {
      console.log('A joined', r);

      // B join
      clientB.emit('join_room', { code: currentCode, playerId: 'B', name: 'B' }, (r2) => {
        console.log('B joined', r2);

        // start game by A (owner)
        setTimeout(() => {
          console.log('Starting game...');
          clientA.emit('start_game', { code: currentCode }, (sres) => {
            console.log('start_game response', sres);
          });
        }, 500);
      });
    });
  });

  // global listeners for game over
  clientA.on('game_over', (info) => {
    console.log('SIM: game_over', info);
    shutdown(0);
  });
  clientB.on('game_over', (info) => {
    console.log('SIM: game_over', info);
    shutdown(0);
  });

  // timeout safety
  setTimeout(() => {
    console.log('SIM: timeout reached, aborting');
    shutdown(1);
  }, 120000); // 2 minutes
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function shutdown(code) {
  try { clientA && clientA.close(); } catch (e) {}
  try { clientB && clientB.close(); } catch (e) {}
  process.exit(code);
}

run();
