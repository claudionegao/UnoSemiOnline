import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    console.log('🔌 Criando nova instância do socket');
    socket = io({ path: '/api/socket' });
    
    socket.on('connect', () => {
      console.log('🟢 Socket conectado globalmente, ID:', socket.id);
    });
    
    socket.on('disconnect', () => {
      console.log('🔴 Socket desconectado');
    });
  } else {
    console.log('♻️ Reutilizando socket existente, ID:', socket.id, 'Conectado:', socket.connected);
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('🔌 Desconectando socket');
    socket.disconnect();
    socket = null;
  }
};
