// UNO Game Helper - Gerenciamento de cartas e regras

// Definição das cartas do UNO
export const CARD_COLORS = {
  RED: 'R',
  BLUE: 'B',
  GREEN: 'G',
  YELLOW: 'Y',
  WILD: 'W'
};

export const CARD_VALUES = {
  ZERO: '0',
  ONE: '1',
  TWO: '2',
  THREE: '3',
  FOUR: '4',
  FIVE: '5',
  SIX: '6',
  SEVEN: '7',
  EIGHT: '8',
  NINE: '9',
  DRAW_TWO: 'Draw',
  REVERSE: 'Reverse',
  SKIP: 'Skip',
  WILD: 'W',
  WILD_DRAW_FOUR: 'WDraw'
};

// Cria um baralho completo de UNO
export function createFullDeck() {
  const deck = [];
  const colors = [CARD_COLORS.RED, CARD_COLORS.BLUE, CARD_COLORS.GREEN, CARD_COLORS.YELLOW];
  
  // Para cada cor
  colors.forEach(color => {
    // Uma carta 0
    deck.push({ color, value: '0', id: `${color}0` });
    
    // Duas cartas de cada número 1-9
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: String(i), id: `${color}${i}_1` });
      deck.push({ color, value: String(i), id: `${color}${i}_2` });
    }
    
    // Duas cartas especiais de cada tipo (+2, Reverse, Skip)
    deck.push({ color, value: 'Draw', id: `${color}Draw_1` });
    deck.push({ color, value: 'Draw', id: `${color}Draw_2` });
    deck.push({ color, value: 'Reverse', id: `${color}Reverse_1` });
    deck.push({ color, value: 'Reverse', id: `${color}Reverse_2` });
    deck.push({ color, value: 'Skip', id: `${color}Skip_1` });
    deck.push({ color, value: 'Skip', id: `${color}Skip_2` });
  });
  
  // 4 cartas Wild
  for (let i = 1; i <= 4; i++) {
    deck.push({ color: CARD_COLORS.WILD, value: 'W', id: `W_${i}` });
  }
  
  // 4 cartas Wild +4
  for (let i = 1; i <= 4; i++) {
    deck.push({ color: CARD_COLORS.WILD, value: 'WDraw', id: `WDraw_${i}` });
  }
  
  return deck;
}

// Embaralha um array
export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Distribui cartas iniciais para os jogadores
export function dealInitialHands(deck, numPlayers, cardsPerPlayer = 7) {
  const hands = [];
  let remainingDeck = [...deck];
  
  for (let player = 0; player < numPlayers; player++) {
    const hand = [];
    for (let card = 0; card < cardsPerPlayer; card++) {
      if (remainingDeck.length > 0) {
        hand.push(remainingDeck.pop());
      }
    }
    hands.push(hand);
  }
  
  return { hands, remainingDeck };
}

// Pega uma carta válida (não-wild) para iniciar o descarte
export function getInitialDiscardCard(deck) {
  const validCards = deck.filter(card => 
    card.color !== CARD_COLORS.WILD
  );
  
  if (validCards.length === 0) {
    // Fallback: retorna qualquer carta que não seja Wild +4
    return deck.find(card => card.value !== 'WDraw') || deck[0];
  }
  
  const randomIndex = Math.floor(Math.random() * validCards.length);
  const selectedCard = validCards[randomIndex];
  
  // Remove a carta do baralho
  const deckIndex = deck.findIndex(card => card.id === selectedCard.id);
  deck.splice(deckIndex, 1);
  
  return selectedCard;
}

// Compra uma carta do baralho
export function drawCard(deck) {
  if (deck.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * deck.length);
  const card = deck.splice(randomIndex, 1)[0];
  return card;
}

// Verifica se uma carta pode ser jogada
export function isValidPlay(card, topCard, declaredColor = null) {
  // Wild cards podem sempre ser jogadas
  if (card.color === CARD_COLORS.WILD) {
    return true;
  }
  
  // Se a carta do topo é Wild e uma cor foi declarada
  if (topCard.color === CARD_COLORS.WILD && declaredColor) {
    return card.color === declaredColor;
  }
  
  // Mesma cor
  if (card.color === topCard.color) {
    return true;
  }
  
  // Mesmo valor
  if (card.value === topCard.value) {
    return true;
  }
  
  return false;
}

// Verifica se uma carta é Draw (+2 ou +4)
export function isDrawCard(card) {
  return card.value === 'Draw' || card.value === 'WDraw';
}

// Encontra cartas Draw na mão que podem ser usadas para defender
export function getDefensiveDrawCards(hand, attackCard) {
  if (!isDrawCard(attackCard)) return [];
  
  // Se atacou com +4, só pode defender com +4
  if (attackCard.value === 'WDraw') {
    return hand.filter(card => card.value === 'WDraw');
  }
  
  // Se atacou com +2, pode defender com +2 ou +4
  if (attackCard.value === 'Draw') {
    return hand.filter(card => card.value === 'Draw' || card.value === 'WDraw');
  }
  
  return [];
}

// Calcula total de cartas a comprar acumuladas
export function calculateDrawPenalty(card) {
  if (card.value === 'Draw') return 2;
  if (card.value === 'WDraw') return 4;
  return 0;
}

// Inicializa um jogo novo
export function initializeGame(playerIds) {
  const fullDeck = createFullDeck();
  const shuffledDeck = shuffleDeck(fullDeck);
  
  const { hands, remainingDeck } = dealInitialHands(shuffledDeck, playerIds.length, 7);
  
  const topCard = getInitialDiscardCard(remainingDeck);
  
  const players = playerIds.map((id, index) => ({
    id,
    hand: hands[index],
    cardCount: hands[index].length
  }));
  
  return {
    players,
    deck: remainingDeck,
    discardPile: [topCard],
    topCard,
    currentPlayerIndex: 0,
    direction: 1, // 1 = horário, -1 = anti-horário
    declaredColor: null,
    pendingDraws: 0,
    waitingForDefense: false,
    defensePlayerId: null
  };
}

// Converte carta para formato de imagem
export function getCardImagePath(card) {
  if (!card) return null;
  
  const colorPrefix = card.color;
  
  // Cartas especiais
  if (card.value === 'Draw' && card.color !== CARD_COLORS.WILD) {
    return `/assets/cards/${colorPrefix}Draw.png`;
  }
  if (card.value === 'Skip') return `/assets/cards/${colorPrefix}Skip.png`;
  if (card.value === 'Reverse') return `/assets/cards/${colorPrefix}Reverse.png`;
  if (card.value === 'WDraw') return `/assets/cards/WDraw.png`;
  if (card.value === 'W') return `/assets/cards/W.png`;
  
  // Cartas numéricas
  return `/assets/cards/${colorPrefix}${card.value}.png`;
}

export default {
  createFullDeck,
  shuffleDeck,
  dealInitialHands,
  getInitialDiscardCard,
  drawCard,
  isValidPlay,
  initializeGame,
  getCardImagePath,
  CARD_COLORS,
  CARD_VALUES
};
