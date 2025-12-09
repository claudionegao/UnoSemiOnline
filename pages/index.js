import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Container,
  Card,
  CardRight,
  Title,
  InputWrapper,
  Input,
  Button,
  Subtitle,
  RoomList,
  RoomItem,
  RoomInfo,
  RoomName,
  RoomStatus,
  RoomButton
} from '../components/style/index';
import ModalName from '../components/ModalName';

export default function Home() {
  const [socket, setSocket] = useState(null);
  const [nome, setNome] = useState('');
  const [salas, setSalas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'criar' ou id da sala
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const socket = io({ 
      path: '/api/socket',
      timeout: 10000,
      reconnectionDelay: 1000
    });
    socket.on('connect', () => {
      console.log('Conectado ao servidor de socket:', socket.id);
    });
    socket.on('updateRooms', (data) => {
      console.log('Salas recebidas:', data.rooms);
      setSalas(data.rooms);
    });
    socket.on('erro', (message) => {
      console.error('Erro do servidor:', message);
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(''), 3000);
    });
    socket.on('connect_error', (error) => {
      console.error('Erro de conexão:', error);
    });
    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Container>
      <h1>Bem-vindo ao Uno Semi Online</h1>
      {errorMessage && (
        <div style={{
          background: '#ff6b6b',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          marginBottom: '10px',
          fontWeight: '600',
          textAlign: 'center'
        }}>
          {errorMessage}
        </div>
      )}
      <Card>
        <Title>Salas</Title>
        {salas.length === 0 && (
          <div style={{
            color: '#667eea',
            fontWeight: 700,
            fontSize: '16px',
            textAlign: 'center',
            margin: '18px 0'
          }}>
            Nenhuma sala disponível.<br />
            Clique em <b>Criar Sala</b> para começar uma partida!
          </div>
        )}
        <RoomList>
          {salas.map((sala) => (
            <RoomItem key={sala.id} isPlaying={sala.isPlaying}>
              <RoomInfo>
                <RoomName isPlaying={sala.isPlaying}>{sala.nome}</RoomName>
                <RoomStatus isPlaying={sala.isPlaying}>
                  {sala.isPlaying 
                    ? '🎮 Em jogo' 
                    : `👥 ${sala.playerCount}/10 jogadores`}
                </RoomStatus>
              </RoomInfo>
              <RoomButton
                disabled={sala.isPlaying || sala.playerCount >= 10}
                onClick={() => {
                  if (!sala.isPlaying && sala.playerCount < 10) {
                    setModalAction(sala.id);
                    setModalOpen(true);
                  }
                }}
              >
                {sala.isPlaying ? 'Em jogo' : sala.playerCount >= 10 ? 'Cheia' : 'Entrar'}
              </RoomButton>
            </RoomItem>
          ))}
        </RoomList>
        <Button onClick={() => { setModalAction('criar'); setModalOpen(true); }}>Criar Sala</Button>
      </Card>
      <ModalName
        open={modalOpen}
        title={modalAction === 'criar' ? 'Informe seu nome para criar a sala' : 'Informe seu nome para entrar'}
        onClose={() => setModalOpen(false)}
        onSubmit={nome => {
          if (modalAction === 'criar') {
            if (!socket) return;
            const nomeSala = `sala do ${nome}`;
            socket.emit('criarSala', nomeSala, (id) => {
              if (id) {
                // Após criar a sala, navega passando o nome via query
                router.push(`/${id}?nome=${encodeURIComponent(nome)}`);
              }
            });
          } else {
            if (!socket) return;
            console.log('Entrando na sala com id:', modalAction);
            socket.emit('entrarSala', modalAction, nome, (id) => {
              console.log('Callback entrarSala recebido, id:', id);
              if (id) {
                router.push(`/${id}?nome=${encodeURIComponent(nome)}`);
              } else {
                console.error('ID da sala não retornado');
                router.push(`/${modalAction}?nome=${encodeURIComponent(nome)}`);
              }
            });
          }
          setModalOpen(false);
        }}
      />
    </Container>
  );
}