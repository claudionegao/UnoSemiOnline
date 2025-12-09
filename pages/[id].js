import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import { getSocket } from '../lib/socket';

const Container = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: azure;
  padding: 20px;
  box-sizing: border-box;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  padding: 32px 24px;
  width: 90vw;
  max-width: 500px;
`;

const Title = styled.h1`
  color: #667eea;
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 24px 0;
  text-align: center;
`;

const PlayerList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 24vh;
  overflow-y: scroll;
  gap: 12px;
  margin-bottom: 24px;
`;

const PlayerItem = styled.div`
  background: ${props => props.ready ? '#d1fae5' : '#f8faff'};
  border: 2px solid ${props => props.ready ? '#10b981' : '#e0e7ff'};
  border-radius: 10px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
`;

const PlayerName = styled.span`
  color: ${props => props.ready ? '#059669' : '#667eea'};
  font-size: 16px;
  font-weight: 700;
`;

const ReadyBadge = styled.span`
  background: #10b981;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
`;

const NotReadyBadge = styled.span`
  color: #a5b4fc;
  font-size: 12px;
  font-weight: 600;
`;

const Button = styled.button`
  width: 100%;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 700;
  background: ${props => props.variant === 'cancel' ? '#ef4444' : props.disabled ? '#e0e7ff' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  color: ${props => props.disabled ? '#a5b4fc' : '#fff'};
  border: none;
  border-radius: 10px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 10px;
  box-shadow: ${props => props.disabled ? 'none' : '0 8px 20px rgba(102, 126, 234, 0.35)'};
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:active:not(:disabled) {
    transform: scale(0.97);
  }
`;

const Countdown = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
  color: white;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 900;
  box-shadow: 0 8px 24px rgba(239, 68, 68, 0.5);
  animation: pulse 1s infinite;
  z-index: 1000;

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
`;

const InfoText = styled.p`
  color: #764ba2;
  font-size: 14px;
  text-align: center;
  margin: 16px 0;
`;

export default function Room() {
  const router = useRouter();
  const { id, nome } = router.query;
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    if (!id || !nome) return;

    const socket = getSocket();
    
    socket.on('connect', () => {
      console.log('Conectado à sala:', socket.id);
      setMyId(socket.id);
      // Entra na sala automaticamente ao conectar
      socket.emit('entrarSala', id, nome, (salaId) => {
        console.log('Entrou na sala:', salaId);
      });
    });
    
    // Se já estiver conectado, entra na sala imediatamente
    if (socket.connected) {
      console.log('Socket já conectado, entrando na sala:', socket.id);
      setMyId(socket.id);
      socket.emit('entrarSala', id, nome, (salaId) => {
        console.log('Entrou na sala:', salaId);
      });
    }

    socket.on('roomUpdate', (data) => {
      console.log('Atualização da sala:', data);
      setPlayers(data.players || []);
      setRoomName(data.roomName || '');
    });

    socket.on('countdownUpdate', (seconds) => {
      setCountdown(seconds);
    });

    socket.on('countdownCancelled', () => {
      setCountdown(null);
    });

    socket.on('gameStart', () => {
      console.log('Jogo iniciando!');
      // Navega para a tela do jogo SEM desconectar o socket
      router.push(`/game/${id}?name=${nome}`);
    });

    return () => {
      // Remove os listeners mas NÃO desconecta o socket
      socket.off('connect');
      socket.off('roomUpdate');
      socket.off('countdownUpdate');
      socket.off('countdownCancelled');
      socket.off('gameStart');
    };
  }, [id, nome]);

  const toggleReady = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('toggleReady', id);
    }
  };

  const cancelCountdown = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('cancelCountdown', id);
    }
  };

  const myPlayer = players.find(p => p.id === myId);
  const allReady = players.length >= 2 && players.every(p => p.ready);

  return (
    <Container>
      {countdown !== null && (
        <Countdown>{countdown}</Countdown>
      )}
      
      <Card>
        <Title>{roomName || `Sala ${id}`}</Title>
        
        <InfoText>
          {players.length} jogador{players.length !== 1 ? 'es' : ''} na sala
          {players.length < 2 && ' (mínimo 2 para começar)'}
        </InfoText>

        <PlayerList>
          {players.map((player) => (
            <PlayerItem key={player.id} ready={player.ready}>
              <PlayerName ready={player.ready}>
                {player.name} {player.id === myId && '(você)'}
              </PlayerName>
              {player.ready ? (
                <ReadyBadge>Pronto!</ReadyBadge>
              ) : (
                <NotReadyBadge>Aguardando...</NotReadyBadge>
              )}
            </PlayerItem>
          ))}
        </PlayerList>

        {myPlayer && (
          <Button 
            onClick={countdown !== null ? cancelCountdown : toggleReady}
            variant={countdown !== null ? 'cancel' : undefined}
          >
            {countdown !== null 
              ? 'Cancelar Início' 
              : (myPlayer.ready ? 'Cancelar Ready' : 'Estou Pronto!')
            }
          </Button>
        )}

        <Button 
          variant="cancel"
          style={{ marginTop: '16px', background: '#94a3b8' }}
          onClick={() => router.push('/')}
        >
          Sair da Sala
        </Button>
      </Card>
    </Container>
  );
}
