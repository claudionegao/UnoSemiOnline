// Lógica básica do jogo UNO (servidor-side, estado em memória)
function createDeck() {
  const colors = ['red', 'green', 'blue', 'yellow'];
  const deck = [];

  // números
  for (const color of colors) {
    deck.push({ type: 'number', color, value: 0 });
    for (let i = 1; i <= 9; i++) {
      deck.push({ type: 'number', color, value: i });
      deck.push({ type: 'number', color, value: i });
    }
    // action cards: skip, reverse, draw2 (2 of each per color)
    for (let i = 0; i < 2; i++) deck.push({ type: 'skip', color });
    for (let i = 0; i < 2; i++) deck.push({ type: 'reverse', color });
    for (let i = 0; i < 2; i++) deck.push({ type: 'draw2', color });
  }

  // wilds
  for (let i = 0; i < 4; i++) deck.push({ type: 'wild' });
  for (let i = 0; i < 4; i++) deck.push({ type: 'wild_draw4' });

  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function drawFrom(deck, count = 1) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) break;
    cards.push(deck.pop());
  }
  return cards;
}

function canPlay(card, topCard) {
  if (!card) return false;
  if (card.type === 'wild' || card.type === 'wild_draw4') return true;
  if (!topCard) return true;
  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
  if (card.color && topCard.color && card.color === topCard.color) return true;
  if (card.type === topCard.type && card.type !== 'number') return true;
  return false;
}

function initGame(playerIds) {
  const deck = createDeck();
  shuffle(deck);
  const players = playerIds.map(id => ({ id, name: id, hand: [] }));

  // Deal 7 cards each
  for (let i = 0; i < 7; i++) {
    for (const p of players) {
      p.hand.push(...drawFrom(deck, 1));
    }
  }

  // put starting top card that's not wild_draw4
  let top = drawFrom(deck, 1)[0];
  while (top && top.type === 'wild_draw4') {
    deck.unshift(top);
    top = drawFrom(deck, 1)[0];
  }

  const state = {
    deck,
    discard: [top],
    players,
    current: 0,
    direction: 1,
    pendingDraw: { type: null, amount: 0 }
  };

  return state;
}

function findPlayerIndex(state, playerId) {
  return state.players.findIndex(p => p.id === playerId);
}

function drawCards(state, playerId, count) {
  if (state.deck.length < count) {
    // reciclar descarte (keep top)
    const top = state.discard.pop();
    const rest = state.discard.splice(0);
    state.deck.push(...rest);
    shuffle(state.deck);
    state.discard = [top];
  }
  const cards = drawFrom(state.deck, count);
  const idx = findPlayerIndex(state, playerId);
  if (idx >= 0) state.players[idx].hand.push(...cards);
  return cards;
}

function nextIndex(state) {
  state.current = (state.current + state.direction + state.players.length) % state.players.length;
}

function playCard(state, playerId, card, chosenColor) {
  const pIdx = findPlayerIndex(state, playerId);
  if (pIdx === -1) throw new Error('player not in game');
  if (state.current !== pIdx) throw new Error('not your turn');
  const player = state.players[pIdx];

  // find matching card in hand (simple deep compare)
  const handIdx = player.hand.findIndex(c => JSON.stringify(c) === JSON.stringify(card));
  if (handIdx === -1) throw new Error('card not in hand');

  const top = state.discard[state.discard.length - 1];
  if (!canPlay(card, top)) throw new Error('card cannot be played');

  // remove from hand and place on discard
  player.hand.splice(handIdx, 1);
  const played = Object.assign({}, card);
  if (played.type === 'wild' || played.type === 'wild_draw4') played.color = chosenColor || null;
  state.discard.push(played);
  // resolve card effects with stacking logic for draw cards
  const pending = state.pendingDraw || { type: null, amount: 0 };

  if (pending.amount > 0) {
    // existe uma penalidade pendente para o jogador atual
    if (played.type === pending.type) {
      // empilha: aumenta a quantidade e passa para o próximo
      const inc = played.type === 'draw2' ? 2 : (played.type === 'wild_draw4' ? 4 : 0);
      pending.amount += inc;
      // atualiza tipo (mantém)
      state.pendingDraw = pending;
      nextIndex(state);
      return { state, playedBy: playerId };
    } else {
      // não é permitido jogar outra carta quando há pending draw
      throw new Error('must_stack_or_draw');
    }
  }

  // Se não havia pending draw
  if (played.type === 'draw2') {
    state.pendingDraw = { type: 'draw2', amount: 2 };
    nextIndex(state);
    return { state, playedBy: playerId };
  }
  if (played.type === 'wild_draw4') {
    state.pendingDraw = { type: 'wild_draw4', amount: 4 };
    nextIndex(state);
    return { state, playedBy: playerId };
  }

  // ações normais
  if (played.type === 'skip') {
    nextIndex(state);
    nextIndex(state);
  } else if (played.type === 'reverse') {
    state.direction *= -1;
    if (state.players.length === 2) nextIndex(state);
    else nextIndex(state);
  } else {
    nextIndex(state);
  }

  // limpar pendingDraw caso exista (por segurança)
  state.pendingDraw = { type: null, amount: 0 };

  return { state, playedBy: playerId };
}

module.exports = { createDeck, shuffle, drawFrom, canPlay, initGame, drawCards, playCard, findPlayerIndex };
