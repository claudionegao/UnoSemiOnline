import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import { getSocket } from '../../lib/socket';

const Container = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: azure;
  overflow: hidden;
  position: relative;
`;

const TopBar = styled.div`
  background: #fff;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const RoomInfo = styled.div`
  color: #667eea;
  font-size: 14px;
  font-weight: 700;
`;

const LeaveButton = styled.button`
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  
  &:active {
    transform: scale(0.95);
  }
`;

const PlayersArea = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
`;

const PlayersList = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  max-width: calc(100vw - 120px);
`;

const PlayerCard = styled.div`
  background: ${props => props.isActive ? '#d1fae5' : '#fff'};
  padding: 6px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 2px solid ${props => props.hasGuard ? '#10b981' : (props.isActive ? '#10b981' : '#e0e7ff')};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  position: relative;
`;

const UnoGuardBadge = styled.div`
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 16px;
  background: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
`;

const PlayerName = styled.span`
  color: ${props => props.isActive ? '#059669' : '#667eea'};
  font-size: 12px;
  font-weight: 700;
`;

const CardCount = styled.span`
  background: ${props => props.isActive ? '#10b981' : '#e0e7ff'};
  color: ${props => props.isActive ? 'white' : '#667eea'};
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
`;

const GameArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const Deck = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

const DeckPile = styled.div`
  width: 100px;
  height: 140px;
  background: #1f2937;
  border-radius: 12px;
  border: 3px solid #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 48px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  
  &:active {
    transform: translateY(2px);
  }
`;

const DiscardPile = styled.div`
  width: 100px;
  height: 140px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  border: ${props => props.declaredColor ? `4px solid ${props.declaredColor}` : 'none'};
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const HandArea = styled.div`
  position: fixed;
  bottom: ${props => props.hidden ? '-100%' : '0'};
  left: 0;
  right: 0;
  background: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
  transition: bottom 0.3s ease;
`;

const ToggleHandButton = styled.button`
  position: fixed;
  bottom: ${props => props.handHidden ? '16px' : 'calc(16px + 140px)'};
  right: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
  z-index: 1000;
  
  &:active {
    transform: scale(0.95);
  }
`;

const HandCards = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  
  &::-webkit-scrollbar {
    height: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #e0e7ff;
    border-radius: 10px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #667eea;
    border-radius: 10px;
  }
`;

const Card = styled.div`
  min-width: 75px;
  height: 105px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  &:hover {
    transform: translateY(-12px);
  }
  
  &:active {
    transform: translateY(-6px);
  }
`;

const UnoButton = styled.button`
  background: ${props => props.guardActive 
    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
    : 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'};
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 20px;
  font-weight: 900;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 2px;
  box-shadow: ${props => props.guardActive 
    ? '0 8px 20px rgba(16, 185, 129, 0.4)' 
    : '0 8px 20px rgba(239, 68, 68, 0.4)'};
  position: relative;
  
  ${props => props.guardActive && `
    &:after {
      content: '✓';
      position: absolute;
      top: -8px;
      right: -8px;
      background: white;
      color: #10b981;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 900;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  `}
  
  &:active {
    transform: scale(0.95);
  }
`;

const Direction = styled.div`
  background: #fff;
  padding: 4px 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  border: 2px solid #e0e7ff;
  color: #667eea;
`;

const PenaltyPopup = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  padding: 24px 48px;
  border-radius: 16px;
  font-size: 24px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 20px 60px rgba(239, 68, 68, 0.6);
  z-index: 10000;
  animation: popupFade 2s ease forwards;
  
  @keyframes popupFade {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
    80% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
    }
  }
`;

const ColorModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ColorModalContent = styled.div`
  background: white;
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease;
  
  @keyframes slideUp {
    from {
      transform: translateY(50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const ColorModalTitle = styled.h2`
  color: #667eea;
  font-size: 24px;
  font-weight: 900;
  margin: 0 0 24px 0;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
`;

const ColorButton = styled.button`
  width: 100px;
  height: 100px;
  border-radius: 20px;
  border: 4px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
  
  &:before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.3s, height 0.3s;
  }
  
  &:hover {
    transform: scale(1.1);
    border-color: white;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  }
  
  &:hover:before {
    width: 100%;
    height: 100%;
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

// Função para converter código de cor para hex
const getColorHex = (colorCode) => {
  const colorMap = {
    'R': '#ef4444', // Vermelho
    'B': '#3b82f6', // Azul
    'G': '#10b981', // Verde
    'Y': '#f59e0b'  // Amarelo
  };
  return colorMap[colorCode] || null;
};

// Função para mapear carta para imagem
const getCardImage = (card) => {
  if (!card) return null;
  
  // As cartas já vêm com color como 'R', 'B', 'G', 'Y', 'W'
  const colorPrefix = card.color;
  
  // Cartas especiais
  if (card.value === 'Draw') return `/assets/cards/${colorPrefix}Draw.png`;
  if (card.value === 'Skip') return `/assets/cards/${colorPrefix}Skip.png`;
  if (card.value === 'Reverse') return `/assets/cards/${colorPrefix}Reverse.png`;
  if (card.value === 'WDraw') return `/assets/cards/WDraw.png`;
  if (card.value === 'W') return `/assets/cards/W.png`;
  
  // Cartas numéricas
  return `/assets/cards/${colorPrefix}${card.value}.png`;
};

export default function Game() {
  const router = useRouter();
  const { id, name } = router.query;
  const [handHidden, setHandHidden] = useState(false);
  const [players, setPlayers] = useState([]);
  const [myHand, setMyHand] = useState([]);
  const [topCard, setTopCard] = useState(null);
  const [declaredColor, setDeclaredColor] = useState(null);
  const [direction, setDirection] = useState(1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [pendingCard, setPendingCard] = useState(null);
  const [showDefenseModal, setShowDefenseModal] = useState(false);
  const [defensiveCards, setDefensiveCards] = useState([]);
  const [pendingDraws, setPendingDraws] = useState(0);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [winnerName, setWinnerName] = useState('');
  const [unoGuard, setUnoGuard] = useState(false);
  const [showPenaltyPopup, setShowPenaltyPopup] = useState(false);

  useEffect(() => {
    if (!id || !name) {
      console.log('❌ Faltando parâmetros - id:', id, 'name:', name);
      return;
    }

    console.log('🎮 Inicializando página do jogo - Sala:', id, 'Jogador:', name);
    const socket = getSocket();
    console.log('📡 Socket obtido, ID:', socket?.id, 'Conectado:', socket?.connected);
    
    // DEBUG: Expõe função para simular vitória no console
    window.simulateVictory = (winnerNameParam) => {
      const victoryName = winnerNameParam || name || 'Jogador';
      console.log('🎮 Simulando vitória de:', victoryName);
      setWinnerName(victoryName);
      setShowVictoryModal(true);
      setTimeout(() => {
        router.push(`/${id}?nome=${encodeURIComponent(name)}`);
      }, 2000);
    };

    socket.on('connect', () => {
      console.log('✅ Socket conectado! ID:', socket.id);
    });

    socket.on('gameInitialized', (data) => {
      console.log('🎲 ===== JOGO INICIALIZADO =====');
      console.log('📥 Dados recebidos:', data);
      console.log('🃏 Cartas na mão:', data.hand?.length);
      console.log('🎯 Carta no topo:', data.topCard);
      console.log('👥 Jogadores:', data.players);
      console.log('🔄 Turno atual:', data.currentPlayerIndex);
      
      setMyHand(data.hand);
      setTopCard(data.topCard);
      setDeclaredColor(data.declaredColor);
      setDirection(data.direction);
      setCurrentPlayerIndex(data.currentPlayerIndex);
      
      // Monta lista de jogadores com os nomes vindos do servidor
      const playersList = data.players.map((p, index) => ({
        id: p.id,
        name: p.name, // Usa o nome do servidor
        cards: p.cardCount,
        isActive: index === data.currentPlayerIndex,
        unoGuard: p.unoGuard || false
      }));
      console.log('👥 Lista de jogadores montada:', playersList);
      setPlayers(playersList);
      
      // Verifica se é minha vez
      const myIndex = playersList.findIndex(p => p.id === socket.id);
      const isMyTurnNow = data.currentPlayerIndex === myIndex;
      setIsMyTurn(isMyTurnNow);
      
      console.log('🎯 Meu índice:', myIndex);
      console.log('✋ É minha vez?', isMyTurnNow);
      console.log('===============================');
    });

    socket.on('gameUpdate', (data) => {
      console.log('🔄 Atualização do jogo:', data);
      setTopCard(data.topCard);
      setDeclaredColor(data.declaredColor);
      setDirection(data.direction);
      setCurrentPlayerIndex(data.currentPlayerIndex);
      
      // Atualiza lista de jogadores com nomes vindos do servidor
      setPlayers(prev => {
        const updated = data.players.map((player, index) => ({
          id: player.id,
          name: player.name, // Usa o nome do servidor
          cards: player.cardCount,
          isActive: index === data.currentPlayerIndex,
          unoGuard: player.unoGuard || false
        }));
        
        // Verifica se é minha vez
        const myIndex = updated.findIndex(p => p.id === socket.id);
        setIsMyTurn(data.currentPlayerIndex === myIndex);
        
        return updated;
      });
    });

    socket.on('drawDefenseOptions', (data) => {
      console.log('🛡️ Opções de defesa recebidas:', data);
      setDefensiveCards(data.defensiveCards);
      setPendingDraws(data.pendingDraws);
      setShowDefenseModal(true);
    });

    socket.on('handUpdate', (data) => {
      console.log('🃏 Mão atualizada:', data);
      setMyHand(data.hand);
    });

    socket.on('unoPenalty', (data) => {
      console.log('⚠️ Você foi penalizado por não gritar UNO!');
      console.log('Acusado por:', data.accuserName);
      
      // Mostra popup de penalidade
      setShowPenaltyPopup(true);
      setTimeout(() => setShowPenaltyPopup(false), 2000);
    });

    socket.on('gameOver', (data) => {
      console.log('🏆 Jogo finalizado! Vencedor:', data.winnerName);
      setWinnerName(data.winnerName);
      setShowVictoryModal(true);
      
      // Redireciona após 2 segundos
      setTimeout(() => {
        router.push(`/${id}?nome=${encodeURIComponent(name)}`);
      }, 2000);
    });

    console.log('🎧 Listeners registrados');
    
    // Solicita o estado atual do jogo ao servidor
    console.log('📨 Solicitando estado do jogo para sala:', id);
    socket.emit('requestGameState', id);

    // Não desconecta o socket ao desmontar
    return () => {
      console.log('🧹 Limpando listeners');
      socket.off('gameInitialized');
      socket.off('gameUpdate');
      socket.off('drawDefenseOptions');
      socket.off('handUpdate');
      socket.off('unoPenalty');
      socket.off('gameOver');
    };
  }, [id, name]);

  const handleCardClick = (card) => {
    if (!isMyTurn) {
      console.log('Não é sua vez!');
      return;
    }

    // Se for carta wild, abrir modal para escolher cor
    if (card.color === 'W') {
      setPendingCard(card);
      setShowColorModal(true);
      return;
    }

    // Jogar carta normal
    playCard(card, null);
  };

  const playCard = (card, selectedColor) => {
    const socket = getSocket();

    socket.emit('playCard', {
      roomId: id,
      card,
      declaredColor: selectedColor
    }, (response) => {
      if (response.success) {
        console.log('Carta jogada com sucesso');
        const newHand = response.hand;
        setMyHand(newHand);
      } else {
        console.log('Erro ao jogar carta:', response.message);
        alert(response.message);
      }
    });
  };

  const handleColorSelect = (color) => {
    setShowColorModal(false);
    
    // Verifica se é uma defesa com Wild
    if (defensiveCards.some(c => c.id === pendingCard?.id)) {
      handleDefendWithWild(pendingCard, color);
    } else {
      // Jogada normal
      playCard(pendingCard, color);
    }
    
    setPendingCard(null);
  };

  const handleDefendWithCard = (card) => {
    const socket = getSocket();
    
    // Se for Wild, pedir cor
    if (card.color === 'W') {
      setPendingCard(card);
      setShowDefenseModal(false);
      setShowColorModal(true);
      return;
    }
    
    socket.emit('defendDraw', {
      roomId: id,
      card,
      declaredColor: null
    }, (response) => {
      if (response.success) {
        console.log('Defendeu com sucesso');
        setMyHand(response.hand);
        setShowDefenseModal(false);
        setDefensiveCards([]);
        setPendingDraws(0);
      } else {
        console.log('Erro ao defender:', response.message);
        alert(response.message);
      }
    });
  };

  const handleDefendWithWild = (card, color) => {
    const socket = getSocket();
    
    socket.emit('defendDraw', {
      roomId: id,
      card,
      declaredColor: color
    }, (response) => {
      if (response.success) {
        console.log('Defendeu com Wild');
        setMyHand(response.hand);
        setShowDefenseModal(false);
        setDefensiveCards([]);
        setPendingDraws(0);
      } else {
        console.log('Erro ao defender:', response.message);
        alert(response.message);
      }
    });
  };

  const handleAcceptDraws = () => {
    const socket = getSocket();
    
    socket.emit('acceptDrawPenalty', id, (response) => {
      if (response.success) {
        console.log('Aceitou penalidade');
        setMyHand(response.hand);
        setShowDefenseModal(false);
        setDefensiveCards([]);
        setPendingDraws(0);
      } else {
        console.log('Erro ao aceitar penalidade:', response.message);
        alert(response.message);
      }
    });
  };

  const handleDrawCard = () => {
    if (!isMyTurn) {
      console.log('Não é sua vez!');
      return;
    }

    const socket = getSocket();

    socket.emit('drawCard', id, (response) => {
      if (response.success) {
        console.log('Carta comprada:', response.card);
        setMyHand(response.hand);
        
        // Remove UNO Guard ao comprar carta
        if (unoGuard) {
          setUnoGuard(false);
          console.log('🚫 UNO Guard removido ao comprar carta');
        }
      } else {
        console.log('Erro ao comprar carta:', response.message);
        alert(response.message);
      }
    });
  };

  const handleUno = () => {
    const socket = getSocket();
    
    // Verifica localmente se tem apenas 1 carta
    if (myHand.length === 1) {
      // Ativa UNO Guard
      setUnoGuard(true);
      console.log('✋ UNO Guard ativado!');
      
      // Notifica servidor
      socket.emit('callUno', id, (response) => {
        if (response.success && response.guardActivated) {
          console.log('✅ UNO Guard confirmado pelo servidor');
        }
      });
    } else {
      // Mais de 1 carta ou 0 cartas - tenta acusar outros jogadores
      console.log('🎮 Tentando acusar jogadores sem UNO Guard...');
      socket.emit('callUno', id, (response) => {
        if (response.success && response.penalizedPlayers > 0) {
          console.log(`✅ ${response.penalizedPlayers} jogador(es) penalizado(s)!`);
        }
      });
    }
  };

  if (!topCard) {
    return (
      <Container style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#667eea', fontSize: '18px', fontWeight: 700 }}>
          Carregando jogo...
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <TopBar>
        <RoomInfo>Sala {id}</RoomInfo>
        <LeaveButton onClick={() => router.push(`/${id}`)}>Sair</LeaveButton>
      </TopBar>

      <PlayersArea>
        <PlayersList>
          {players.map((player, index) => (
            <>
              <PlayerCard key={player.id} isActive={player.isActive} hasGuard={player.unoGuard}>
                <PlayerName isActive={player.isActive}>{player.name}</PlayerName>
                <CardCount isActive={player.isActive}>{player.cards}</CardCount>
                {player.unoGuard && <UnoGuardBadge>🛡️</UnoGuardBadge>}
              </PlayerCard>
              {index < players.length - 1 && (
                <Direction>
                  {direction === 1 ? '→' : '←'}
                </Direction>
              )}
            </>
          ))}
        </PlayersList>

        <GameArea>
          <Deck>
            <DeckPile onClick={handleDrawCard}>
              🂠
            </DeckPile>
            <DiscardPile declaredColor={declaredColor ? getColorHex(declaredColor) : null}>
              <img src={getCardImage(topCard)} alt="Top card" />
            </DiscardPile>
          </Deck>
        </GameArea>
      </PlayersArea>

      <HandArea hidden={handHidden}>
        <HandCards>
          {myHand.map(card => (
            <Card 
              key={card.id}
              onClick={() => handleCardClick(card)}
            >
              <img src={getCardImage(card)} alt={`${card.color} ${card.value}`} />
            </Card>
          ))}
        </HandCards>
        <UnoButton guardActive={unoGuard} onClick={handleUno}>
          {unoGuard ? '✓ UNO GUARD' : 'UNO!'}
        </UnoButton>
      </HandArea>
      
      <ToggleHandButton 
        handHidden={handHidden}
        onClick={() => setHandHidden(!handHidden)}
      >
        {handHidden ? '👁️' : '🙈'}
      </ToggleHandButton>

      {showColorModal && (
        <ColorModal onClick={() => {
          setShowColorModal(false);
          setPendingCard(null);
        }}>
          <ColorModalContent onClick={(e) => e.stopPropagation()}>
            <ColorModalTitle>Escolha uma cor</ColorModalTitle>
            <ColorGrid>
              <ColorButton
                style={{ background: '#ef4444' }}
                onClick={() => handleColorSelect('R')}
                title="Vermelho"
              />
              <ColorButton
                style={{ background: '#3b82f6' }}
                onClick={() => handleColorSelect('B')}
                title="Azul"
              />
              <ColorButton
                style={{ background: '#10b981' }}
                onClick={() => handleColorSelect('G')}
                title="Verde"
              />
              <ColorButton
                style={{ background: '#f59e0b' }}
                onClick={() => handleColorSelect('Y')}
                title="Amarelo"
              />
            </ColorGrid>
          </ColorModalContent>
        </ColorModal>
      )}

      {showDefenseModal && (
        <ColorModal>
          <ColorModalContent onClick={(e) => e.stopPropagation()}>
            <ColorModalTitle>🛡️ Defender ou Comprar {pendingDraws}?</ColorModalTitle>
            <HandCards style={{ justifyContent: 'center', paddingBottom: 0, marginBottom: '16px' }}>
              {defensiveCards.map(card => (
                <Card 
                  key={card.id}
                  onClick={() => handleDefendWithCard(card)}
                  style={{ minWidth: '90px', height: '126px' }}
                >
                  <img src={getCardImage(card)} alt={`${card.color} ${card.value}`} />
                </Card>
              ))}
            </HandCards>
            <ColorButton
              style={{ 
                width: '100%',
                height: '60px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                fontSize: '18px',
                fontWeight: '700'
              }}
              onClick={handleAcceptDraws}
            >
              💥 Comprar {pendingDraws} carta{pendingDraws > 1 ? 's' : ''}
            </ColorButton>
          </ColorModalContent>
        </ColorModal>
      )}

      {showVictoryModal && (
        <ColorModal>
          <ColorModalContent onClick={(e) => e.stopPropagation()}>
            <ColorModalTitle style={{ fontSize: '32px', marginBottom: '0' }}>
              🏆 Vitória de {winnerName}!
            </ColorModalTitle>
          </ColorModalContent>
        </ColorModal>
      )}

      {showPenaltyPopup && (
        <PenaltyPopup>
          ⚠️ PENALIDADE!<br/>
          +2 cartas por não gritar UNO!
        </PenaltyPopup>
      )}
    </Container>
  );
}
