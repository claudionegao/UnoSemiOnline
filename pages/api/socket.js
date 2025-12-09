import { Server } from "socket.io";
import { initializeGame, drawCard, isValidPlay, getDefensiveDrawCards, isDrawCard, calculateDrawPenalty } from "../../lib/unoGame.js";

let clientSockets = [];
let rooms = [];

// Processa efeitos de cartas especiais
function processCardEffect(gameState, card, io, roomId, sala) {
  const { value } = card;
  
  if (value === "Skip") {
    // Pula o próximo jogador
    gameState.currentPlayerIndex = 
      (gameState.currentPlayerIndex + gameState.direction + gameState.players.length) 
      % gameState.players.length;
  } else if (value === "Reverse") {
    // Inverte a direção
    gameState.direction *= -1;
  } else if (value === "Draw" || value === "WDraw") {
    // Acumula penalidade de draw
    const drawAmount = calculateDrawPenalty(card);
    gameState.pendingDraws = (gameState.pendingDraws || 0) + drawAmount;
    
    // Próximo jogador
    const nextPlayerIndex = 
      (gameState.currentPlayerIndex + gameState.direction + gameState.players.length) 
      % gameState.players.length;
    const nextPlayer = gameState.players[nextPlayerIndex];
    
    // Verifica se próximo jogador pode defender
    const defensiveCards = getDefensiveDrawCards(nextPlayer.hand, card);
    
    if (defensiveCards.length > 0) {
      console.log(`🛡️ Jogador ${nextPlayer.id} pode defender com ${defensiveCards.length} cartas`);
      
      // Envia opções de defesa para o próximo jogador
      io.to(nextPlayer.id).emit("drawDefenseOptions", {
        defensiveCards,
        pendingDraws: gameState.pendingDraws,
        attackCard: card
      });
      
      // Marca que está esperando defesa
      gameState.waitingForDefense = true;
      gameState.defensePlayerId = nextPlayer.id;
    } else {
      // Jogador não pode defender, compra todas as cartas
      console.log(`💥 Jogador ${nextPlayer.id} vai comprar ${gameState.pendingDraws} cartas`);
      applyDrawPenalty(gameState, nextPlayerIndex, io, roomId, sala);
      
      // Envia mão atualizada para o jogador que recebeu a penalidade
      io.to(nextPlayer.id).emit("handUpdate", {
        hand: nextPlayer.hand
      });
    }
  }
}

// Aplica penalidade de comprar cartas
function applyDrawPenalty(gameState, playerIndex, io, roomId, sala) {
  const player = gameState.players[playerIndex];
  const drawCount = gameState.pendingDraws || 0;
  
  for (let i = 0; i < drawCount; i++) {
    const drawnCard = drawCard(gameState.deck);
    if (drawnCard) {
      player.hand.push(drawnCard);
      player.cardCount++;
    }
  }
  
  // Reseta penalidade
  gameState.pendingDraws = 0;
  gameState.waitingForDefense = false;
  gameState.defensePlayerId = null;
  
  // Pula a vez do jogador que comprou
  gameState.currentPlayerIndex = 
    (playerIndex + gameState.direction + gameState.players.length) 
    % gameState.players.length;
  
  // Envia atualização do jogo para todos os jogadores
  if (io && roomId && sala) {
    io.to(`sala_${roomId}`).emit("gameUpdate", {
      topCard: gameState.topCard,
      declaredColor: gameState.declaredColor,
      players: gameState.players.map((p) => {
        const playerInfo = sala.players.find(sp => sp.id === p.id);
        return {
          id: p.id,
          cardCount: p.cardCount,
          name: playerInfo?.name || 'Jogador',
          unoGuard: p.unoGuard || false
        };
      }),
      currentPlayerIndex: gameState.currentPlayerIndex,
      direction: gameState.direction
    });
  }
}

export default function handler(req, res) {
  if (res.socket.server.io) {
    console.log("Socket.io já está inicializado");
    res.end();
    return;
  }

  const io = new Server(res.socket.server, { 
    path: '/api/socket',
    addTrailingSlash: false
  });

  res.socket.server.io = io;

  io.on("connection", (socket) => {
    console.log("Cliente conectado:", socket.id);
    console.log("Salas atuais para enviar:", rooms);
    clientSockets.push(socket);
    
    // Envia as salas existentes para o cliente que acabou de conectar
    const roomsInfo = rooms.map(r => ({
      id: r.id,
      nome: r.nome,
      playerCount: r.players?.length || 0,
      isPlaying: r.gameState !== null
    }));
    socket.emit("updateRooms", { rooms: roomsInfo });
    console.log("updateRooms enviado para cliente:", socket.id);

    // adiciona um listener para criar salas
    socket.on("criarSala", (nomeSala, callback) => {
      const salaExiste = rooms.find(r => r.nome === nomeSala);
      if (!salaExiste) {
        const novaSala = {
          nome: nomeSala, 
          id: rooms.length + 1, 
          clients: [], 
          players: [], 
          countdown: null,
          gameState: null  // Fix: inicializa gameState como null
        };
        rooms.push(novaSala);
        console.log(`Sala criada: ${nomeSala} por ${socket.id}`);
        // Envia a lista atualizada de salas para TODOS os clientes
        const roomsInfo = rooms.map(r => ({
          id: r.id,
          nome: r.nome,
          playerCount: r.players?.length || 0,
          isPlaying: r.gameState !== null
        }));
        io.emit("updateRooms", { rooms: roomsInfo });
        // Chama o callback passando o ID da sala criada
        if (callback) callback(novaSala.id);
      } else {
        socket.emit("erro", `A sala ${nomeSala} já existe.`);
        if (callback) callback(null);
      }
    });
    socket.on("entrarSala", (idSala, nome, callback) => {
      console.log(`Tentando entrar na sala ${idSala} com nome ${nome}`);
      const sala = rooms.find(room => room.id == idSala); // Usando == para comparar string com number
      if (sala) {
        // Verifica se o jogo está acontecendo
        if (sala.gameState !== null) {
          console.log(`Sala ${idSala} está em jogo, entrada bloqueada`);
          socket.emit("erro", "Não é possível entrar, o jogo já começou");
          if (callback) callback(null);
          return;
        }
        
        // Verifica limite de jogadores
        if (sala.players && sala.players.length >= 10) {
          console.log(`Sala ${idSala} está cheia (10 jogadores)`);
          socket.emit("erro", "Sala cheia! Máximo de 10 jogadores");
          if (callback) callback(null);
          return;
        }
        
        // Verifica se o jogador já está na sala (reconexão ou retorno do jogo)
        if (!sala.players) sala.players = [];
        const existingPlayerIndex = sala.players.findIndex(p => p.id === socket.id);
        
        // Verifica duplicata de nome (ignora jogadores desconectados aguardando timeout)
        const duplicateNameIndex = sala.players.findIndex(
          p => p.name === nome && p.id !== socket.id && !p.disconnected
        );
        
        if (existingPlayerIndex === -1) {
          // Verifica se existe jogador desconectado com mesmo nome (reconexão com novo ID)
          const disconnectedPlayerIndex = sala.players.findIndex(
            p => p.name === nome && p.disconnected
          );
          
          if (disconnectedPlayerIndex !== -1) {
            // Reconexão com novo socket ID - atualiza o jogador existente
            const player = sala.players[disconnectedPlayerIndex];
            const oldSocketId = player.id;
            
            if (player.disconnectTimeout) {
              clearTimeout(player.disconnectTimeout);
              player.disconnectTimeout = null;
            }
            
            // IMPORTANTE: Remove o socket ANTIGO da sala antes de atualizar o ID
            io.sockets.sockets.get(oldSocketId)?.leave(`sala_${idSala}`);
            
            player.id = socket.id;  // Atualiza para o novo socket ID
            player.disconnected = false;
            player.disconnectTime = null;
            player.ready = false;
            console.log(`🔄 ${nome} reconectou com novo ID! (${oldSocketId} → ${socket.id})`);
          } else if (duplicateNameIndex !== -1) {
            // Nome duplicado com jogador ativo
            console.log(`⚠️ Nome duplicado detectado: ${nome}`);
            socket.emit("erro", "Nome já está em uso nesta sala!");
            if (callback) callback(null);
            return;
          } else {
            // Jogador novo
            const player = { id: socket.id, name: nome, ready: false, disconnected: false };
            sala.players.push(player);
            console.log(`✅ Cliente ${socket.id} (${nome}) entrou na sala ${sala.nome}`);
          }
        } else {
          // Reconexão com mesmo ID - limpa timeout e marca como conectado
          const player = sala.players[existingPlayerIndex];
          
          if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
            player.disconnectTimeout = null;
            console.log(`🔄 ${nome} reconectou! Timeout cancelado.`);
          }
          
          player.disconnected = false;
          player.disconnectTime = null;
          player.name = nome;
          player.ready = false;
          console.log(`✅ Cliente ${socket.id} (${nome}) reconectou na sala ${sala.nome}`);
        }
        
        socket.join(`sala_${idSala}`);
        
        // Envia atualização da sala para todos na sala
        io.to(`sala_${idSala}`).emit("roomUpdate", {
          players: sala.players,
          roomName: sala.nome
        });
        
        // Atualiza lista de salas no lobby
        const roomsInfo = rooms.map(r => ({
          id: r.id,
          nome: r.nome,
          playerCount: r.players?.length || 0,
          isPlaying: r.gameState !== null
        }));
        io.emit("updateRooms", { rooms: roomsInfo });
        
        // Chama o callback confirmando a entrada
        console.log(`Chamando callback com id: ${sala.id}`);
        if (callback) callback(sala.id);
      } else {
        console.error(`Sala ${idSala} não encontrada`);
        socket.emit("erro", `A sala com id ${idSala} não existe.`);
        if (callback) callback(null);
      }
    });

    socket.on("toggleReady", (idSala) => {
      const sala = rooms.find(room => room.id == idSala);
      if (sala && sala.players) {
        const player = sala.players.find(p => p.id === socket.id);
        if (player) {
          player.ready = !player.ready;
          
          // Envia atualização da sala
          io.to(`sala_${idSala}`).emit("roomUpdate", {
            players: sala.players,
            roomName: sala.nome
          });
          
          // Se todos estiverem prontos e houver pelo menos 2 jogadores, inicia contagem
          const allReady = sala.players.length >= 2 && sala.players.every(p => p.ready);
          if (allReady && !sala.countdown) {
            startCountdown(sala, idSala, io);
          } else if (!allReady && sala.countdown) {
            // Cancela contagem se alguém desmarcar ready
            clearInterval(sala.countdown);
            sala.countdown = null;
            io.to(`sala_${idSala}`).emit("countdownCancelled");
          }
        }
      }
    });

    socket.on("cancelCountdown", (idSala) => {
      const sala = rooms.find(room => room.id == idSala);
      if (sala && sala.countdown) {
        clearInterval(sala.countdown);
        sala.countdown = null;
        // Desmarca ready de todos os jogadores
        sala.players.forEach(p => p.ready = false);
        io.to(`sala_${idSala}`).emit("countdownCancelled");
        io.to(`sala_${idSala}`).emit("roomUpdate", {
          players: sala.players,
          roomName: sala.nome
        });
      }
    });

    socket.on("sairSala", (idSala) => {
      console.log(`Jogador ${socket.id} saindo da sala ${idSala}`);
      const sala = rooms.find(room => room.id == idSala);
      
      if (sala) {
        // Remove o jogador da sala IMEDIATAMENTE (sair intencional, não desconexão)
        const playerIndex = sala.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = sala.players[playerIndex];
          const playerName = player.name;
          
          // Cancela timeout se houver (em caso de reconexão durante grace period)
          if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
            player.disconnectTimeout = null;
          }
          
          sala.players.splice(playerIndex, 1);
          console.log(`✅ ${playerName} saiu da sala ${sala.nome}`);
        }
        
        // Se o jogo estava em andamento, remove do gameState também
        if (sala.gameState) {
          const gamePlayerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
          if (gamePlayerIndex !== -1) {
            sala.gameState.players.splice(gamePlayerIndex, 1);
            
            // Ajusta currentPlayerIndex se necessário
            if (sala.gameState.players.length > 0) {
              if (sala.gameState.currentPlayerIndex >= sala.gameState.players.length) {
                sala.gameState.currentPlayerIndex = 0;
              }
            } else {
              // Sem jogadores, encerra jogo
              sala.gameState = null;
            }
          }
        }
        
        // Cancela countdown se houver
        if (sala.countdown) {
          clearInterval(sala.countdown);
          sala.countdown = null;
          io.to(`sala_${idSala}`).emit("countdownCancelled");
        }
        
        // Remove da sala Socket.IO
        socket.leave(`sala_${idSala}`);
        
        // Notifica outros jogadores
        io.to(`sala_${idSala}`).emit("roomUpdate", {
          players: sala.players,
          roomName: sala.nome
        });
        
        // Remove sala se ficou vazia
        if (sala.players.length === 0) {
          const roomIndex = rooms.findIndex(r => r.id === sala.id);
          if (roomIndex !== -1) {
            rooms.splice(roomIndex, 1);
            console.log(`🗑️ Sala ${sala.nome} removida (vazia)`);
          }
        }
        
        // Atualiza lista de salas no lobby
        const roomsInfo = rooms.map(r => ({
          id: r.id,
          nome: r.nome,
          playerCount: r.players?.length || 0,
          isPlaying: r.gameState !== null
        }));
        io.emit("updateRooms", { rooms: roomsInfo });
      }
    });

    socket.on("playCard", (data, callback) => {
      const { roomId, card, declaredColor } = data;
      const sala = rooms.find(room => room.id == roomId);
      
      if (!sala || !sala.gameState) {
        if (callback) callback({ success: false, message: "Sala ou jogo não encontrado" });
        return;
      }
      
      const playerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) {
        if (callback) callback({ success: false, message: "Jogador não encontrado" });
        return;
      }
      
      // Verifica se é a vez do jogador
      if (playerIndex !== sala.gameState.currentPlayerIndex) {
        if (callback) callback({ success: false, message: "Não é sua vez" });
        return;
      }
      
      // Verifica se a jogada é válida
      const isValid = isValidPlay(card, sala.gameState.topCard, sala.gameState.declaredColor);
      if (!isValid) {
        if (callback) callback({ success: false, message: "Jogada inválida" });
        return;
      }
      
      // Remove a carta da mão do jogador
      const player = sala.gameState.players[playerIndex];
      const cardIndex = player.hand.findIndex(c => c.id === card.id);
      if (cardIndex === -1) {
        if (callback) callback({ success: false, message: "Carta não encontrada na mão" });
        return;
      }
      
      player.hand.splice(cardIndex, 1);
      player.cardCount = player.hand.length;
      
      // Adiciona carta ao descarte e atualiza topCard
      sala.gameState.discardPile.push(card);
      sala.gameState.topCard = card;
      sala.gameState.declaredColor = declaredColor || null;
      
      // Processa efeitos da carta
      processCardEffect(sala.gameState, card, io, roomId, sala);
      
      // Avança para próximo jogador (só se não for carta Draw ou se não estiver esperando defesa)
      if (!isDrawCard(card) || !sala.gameState.waitingForDefense) {
        sala.gameState.currentPlayerIndex = 
          (sala.gameState.currentPlayerIndex + sala.gameState.direction + sala.gameState.players.length) 
          % sala.gameState.players.length;
      }
      
      // Verifica vitória
      if (player.hand.length === 0) {
        const winnerName = sala.players[playerIndex]?.name || 'Jogador';
        console.log(`🏆 Vitória de ${winnerName}!`);
        
        // Emite evento de vitória
        io.to(`sala_${roomId}`).emit("gameOver", {
          winnerId: socket.id,
          winnerName: winnerName
        });
        
        // Reseta o estado do jogo e marca todos como não prontos
        sala.gameState = null;
        sala.players.forEach(p => p.ready = false);
        
        // Atualiza lista de salas no lobby (jogo terminou)
        const roomsInfo = rooms.map(r => ({
          id: r.id,
          nome: r.nome,
          playerCount: r.players?.length || 0,
          isPlaying: r.gameState !== null
        }));
        io.emit("updateRooms", { rooms: roomsInfo });
        
        if (callback) callback({ success: true, hand: player.hand, winner: true });
        return;
      }
      
      // Envia atualização para todos os jogadores
      io.to(`sala_${roomId}`).emit("gameUpdate", {
        topCard: sala.gameState.topCard,
        declaredColor: sala.gameState.declaredColor,
        players: sala.gameState.players.map((p) => {
          const playerInfo = sala.players.find(sp => sp.id === p.id);
          return {
            id: p.id,
            cardCount: p.cardCount,
            name: playerInfo?.name || 'Jogador',
            unoGuard: p.unoGuard || false
          };
        }),
        currentPlayerIndex: sala.gameState.currentPlayerIndex,
        direction: sala.gameState.direction
      });
      
      if (callback) callback({ success: true, hand: player.hand });
    });

    socket.on("drawCard", (roomId, callback) => {
      const sala = rooms.find(room => room.id == roomId);
      
      if (!sala || !sala.gameState) {
        if (callback) callback({ success: false, message: "Sala ou jogo não encontrado" });
        return;
      }
      
      const playerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) {
        if (callback) callback({ success: false, message: "Jogador não encontrado" });
        return;
      }
      
      // Verifica se é a vez do jogador
      if (playerIndex !== sala.gameState.currentPlayerIndex) {
        if (callback) callback({ success: false, message: "Não é sua vez" });
        return;
      }
      
      const card = drawCard(sala.gameState.deck);
      if (!card) {
        if (callback) callback({ success: false, message: "Baralho vazio" });
        return;
      }
      
      const player = sala.gameState.players[playerIndex];
      player.hand.push(card);
      player.cardCount = player.hand.length;
      
      // Remove UNO Guard ao comprar carta
      if (player.unoGuard) {
        player.unoGuard = false;
        console.log(`🚫 UNO Guard removido do jogador ${player.id}`);
      }
      
      // Avança para o próximo jogador após comprar
      sala.gameState.currentPlayerIndex = 
        (sala.gameState.currentPlayerIndex + sala.gameState.direction + sala.gameState.players.length) 
        % sala.gameState.players.length;
      
      // Envia atualização para todos os jogadores
      io.to(`sala_${roomId}`).emit("gameUpdate", {
        topCard: sala.gameState.topCard,
        declaredColor: sala.gameState.declaredColor,
        players: sala.gameState.players.map((p) => {
          const playerInfo = sala.players.find(sp => sp.id === p.id);
          return {
            id: p.id,
            cardCount: p.cardCount,
            name: playerInfo?.name || 'Jogador',
            unoGuard: p.unoGuard || false
          };
        }),
        currentPlayerIndex: sala.gameState.currentPlayerIndex,
        direction: sala.gameState.direction
      });
      
      if (callback) callback({ success: true, card, hand: player.hand });
    });

    socket.on("defendDraw", (data, callback) => {
      const { roomId, card, declaredColor } = data;
      const sala = rooms.find(room => room.id == roomId);
      
      if (!sala || !sala.gameState) {
        if (callback) callback({ success: false, message: "Sala ou jogo não encontrado" });
        return;
      }
      
      // Verifica se já está processando defesa (proteção contra race condition)
      if (sala.gameState.processingDefense) {
        if (callback) callback({ success: false, message: "Aguarde o processamento anterior" });
        return;
      }
      
      // Verifica se está esperando defesa deste jogador
      if (!sala.gameState.waitingForDefense || sala.gameState.defensePlayerId !== socket.id) {
        if (callback) callback({ success: false, message: "Não é momento de defender" });
        return;
      }
      
      // Trava processamento
      sala.gameState.processingDefense = true;
      
      const playerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
      const player = sala.gameState.players[playerIndex];
      
      // Remove carta da mão
      const cardIndex = player.hand.findIndex(c => c.id === card.id);
      if (cardIndex === -1) {
        if (callback) callback({ success: false, message: "Carta não encontrada" });
        return;
      }
      
      player.hand.splice(cardIndex, 1);
      player.cardCount = player.hand.length;
      
      // Verifica vitória após defesa
      if (player.hand.length === 0) {
        const winnerName = sala.players[playerIndex]?.name || 'Jogador';
        console.log(`🏆 Vitória de ${winnerName}!`);
        
        // Emite evento de vitória
        io.to(`sala_${roomId}`).emit("gameOver", {
          winnerId: socket.id,
          winnerName: winnerName
        });
        
        // Reseta o estado do jogo e marca todos como não prontos
        sala.gameState = null;
        sala.players.forEach(p => p.ready = false);
        
        // Atualiza lista de salas no lobby (jogo terminou)
        const roomsInfo = rooms.map(r => ({
          id: r.id,
          nome: r.nome,
          playerCount: r.players?.length || 0,
          isPlaying: r.gameState !== null
        }));
        io.emit("updateRooms", { rooms: roomsInfo });
        
        // Destrava processamento
        sala.gameState.processingDefense = false;
        
        if (callback) callback({ success: true, hand: player.hand, winner: true });
        return;
      }
      
      // Adiciona carta ao descarte
      sala.gameState.discardPile.push(card);
      sala.gameState.topCard = card;
      sala.gameState.declaredColor = declaredColor || null;
      
      // Acumula mais penalidade
      const drawAmount = calculateDrawPenalty(card);
      sala.gameState.pendingDraws += drawAmount;
      
      // Reseta estado de defesa temporariamente
      sala.gameState.waitingForDefense = false;
      sala.gameState.defensePlayerId = null;
      
      // Avança para próximo jogador A PARTIR DE QUEM DEFENDEU
      const nextPlayerIndex = 
        (playerIndex + sala.gameState.direction + sala.gameState.players.length) 
        % sala.gameState.players.length;
      
      // Atualiza currentPlayerIndex
      sala.gameState.currentPlayerIndex = nextPlayerIndex;
      
      // Verifica se próximo jogador pode defender
      const nextPlayer = sala.gameState.players[nextPlayerIndex];
      const defensiveCards = getDefensiveDrawCards(nextPlayer.hand, card);
      
      if (defensiveCards.length > 0) {
        console.log(`🛡️ Jogador ${nextPlayer.id} pode defender com ${defensiveCards.length} cartas`);
        
        sala.gameState.waitingForDefense = true;
        sala.gameState.defensePlayerId = nextPlayer.id;
        
        io.to(nextPlayer.id).emit("drawDefenseOptions", {
          defensiveCards,
          pendingDraws: sala.gameState.pendingDraws,
          attackCard: card
        });
      } else {
        // Não pode defender, compra todas
        console.log(`💥 Jogador ${nextPlayer.id} vai comprar ${sala.gameState.pendingDraws} cartas`);
        applyDrawPenalty(sala.gameState, nextPlayerIndex, io, roomId, sala);
        
        // Envia mão atualizada para o jogador que recebeu a penalidade
        io.to(nextPlayer.id).emit("handUpdate", {
          hand: nextPlayer.hand
        });
      }
      
      // Envia atualização
      io.to(`sala_${roomId}`).emit("gameUpdate", {
        topCard: sala.gameState.topCard,
        declaredColor: sala.gameState.declaredColor,
        players: sala.gameState.players.map((p) => {
          const playerInfo = sala.players.find(sp => sp.id === p.id);
          return {
            id: p.id,
            cardCount: p.cardCount,
            name: playerInfo?.name || 'Jogador'
          };
        }),
        currentPlayerIndex: sala.gameState.currentPlayerIndex,
        direction: sala.gameState.direction
      });
      
      // Destrava processamento
      sala.gameState.processingDefense = false;
      
      if (callback) callback({ success: true, hand: player.hand });
    });

    socket.on("callUno", (roomId, callback) => {
      const sala = rooms.find(room => room.id == roomId);
      
      if (!sala || !sala.gameState) {
        if (callback) callback({ success: false, message: "Sala ou jogo não encontrado" });
        return;
      }
      
      // Verifica se já está processando defesa (proteção contra race condition)
      if (sala.gameState.processingDefense) {
        if (callback) callback({ success: false, message: "Aguarde o processamento anterior" });
        return;
      }
      
      // Verifica se está esperando defesa deste jogador
      if (!sala.gameState.waitingForDefense || sala.gameState.defensePlayerId !== socket.id) {
        if (callback) callback({ success: false, message: "Não é momento de aceitar penalidade" });
        return;
      }
      
      // Trava processamento
      sala.gameState.processingDefense = true;
      
      const playerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
      
      // Aplica penalidade
      applyDrawPenalty(sala.gameState, playerIndex, io, roomId, sala);
      
      const player = sala.gameState.players[playerIndex];
      
      // Envia mão atualizada para o jogador que aceitou a penalidade
      socket.emit("handUpdate", {
        hand: player.hand
      });
      
      // Envia atualização
      io.to(`sala_${roomId}`).emit("gameUpdate", {
        topCard: sala.gameState.topCard,
        declaredColor: sala.gameState.declaredColor,
        players: sala.gameState.players.map((p) => {
          const playerInfo = sala.players.find(sp => sp.id === p.id);
          return {
            id: p.id,
            cardCount: p.cardCount,
            name: playerInfo?.name || 'Jogador'
          };
        }),
        currentPlayerIndex: sala.gameState.currentPlayerIndex,
        direction: sala.gameState.direction
      });
      
      // Destrava processamento
      sala.gameState.processingDefense = false;
      
      if (callback) callback({ success: true, hand: player.hand });
    });

    socket.on("callUno", (roomId, callback) => {
      const sala = rooms.find(room => room.id == roomId);
      
      if (!sala || !sala.gameState) {
        if (callback) callback({ success: false, message: "Sala ou jogo não encontrado" });
        return;
      }
      
      const callerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
      if (callerIndex === -1) {
        if (callback) callback({ success: false, message: "Jogador não encontrado" });
        return;
      }
      
      const caller = sala.gameState.players[callerIndex];
      
      // Se o jogador que apertou tem exatamente 1 carta, ativa seu UNO Guard
      if (caller.hand.length === 1) {
        caller.unoGuard = true;
        console.log(`✋ Jogador ${caller.id} ativou UNO Guard`);
        
        // Envia atualização para TODOS os jogadores
        io.to(`sala_${roomId}`).emit("gameUpdate", {
          topCard: sala.gameState.topCard,
          declaredColor: sala.gameState.declaredColor,
          players: sala.gameState.players.map((p) => {
            const playerInfo = sala.players.find(sp => sp.id === p.id);
            return {
              id: p.id,
              cardCount: p.cardCount,
              name: playerInfo?.name || 'Jogador',
              unoGuard: p.unoGuard || false
            };
          }),
          currentPlayerIndex: sala.gameState.currentPlayerIndex,
          direction: sala.gameState.direction
        });
        
        if (callback) callback({ success: true, guardActivated: true });
        return;
      }
      
      // Se tem mais de 1 carta, verifica se está acusando outro jogador
      // Procura jogadores com 1 carta sem UNO Guard
      const vulnerablePlayers = sala.gameState.players.filter((p, idx) => 
        idx !== callerIndex && p.hand.length === 1 && !p.unoGuard
      );
      
      if (vulnerablePlayers.length > 0) {
        // Penaliza todos os jogadores vulneráveis
        vulnerablePlayers.forEach(victim => {
          console.log(`⚠️ Jogador ${victim.id} foi acusado! Comprando 2 cartas...`);
          
          // Compra 2 cartas
          for (let i = 0; i < 2; i++) {
            const card = drawCard(sala.gameState.deck);
            if (card) {
              victim.hand.push(card);
              victim.cardCount++;
            }
          }
          
          // Notifica o jogador penalizado
          io.to(victim.id).emit("unoPenalty", {
            accuserId: socket.id,
            accuserName: sala.players[callerIndex]?.name || 'Jogador'
          });
          
          // Atualiza mão do jogador penalizado
          io.to(victim.id).emit("handUpdate", {
            hand: victim.hand
          });
        });
        
        // Envia atualização do jogo para todos
        io.to(`sala_${roomId}`).emit("gameUpdate", {
          topCard: sala.gameState.topCard,
          declaredColor: sala.gameState.declaredColor,
          players: sala.gameState.players.map((p) => {
            const playerInfo = sala.players.find(sp => sp.id === p.id);
            return {
              id: p.id,
              cardCount: p.cardCount,
              name: playerInfo?.name || 'Jogador',
              unoGuard: p.unoGuard || false
            };
          }),
          currentPlayerIndex: sala.gameState.currentPlayerIndex,
          direction: sala.gameState.direction
        });
        
        if (callback) callback({ success: true, penalizedPlayers: vulnerablePlayers.length });
      } else {
        // Ninguém para penalizar
        if (callback) callback({ success: true, guardActivated: false, penalizedPlayers: 0 });
      }
    });

    socket.on("requestGameState", (roomId) => {
      console.log(`📨 Jogador ${socket.id} solicitou estado do jogo da sala ${roomId}`);
      const sala = rooms.find(room => room.id == roomId);
      
      if (!sala || !sala.gameState) {
        console.log(`❌ Sala ${roomId} não encontrada ou jogo não iniciado`);
        return;
      }
      
      console.log('🔍 Estrutura sala.players:', sala.players);
      console.log('🔍 Estrutura sala.gameState.players:', sala.gameState.players.map(p => ({ id: p.id, cardCount: p.cardCount })));
      
      const playerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) {
        console.log(`❌ Jogador ${socket.id} não encontrado na sala`);
        return;
      }
      
      const playerHand = sala.gameState.players[playerIndex].hand;
      console.log(`✅ Reenviando gameInitialized para ${socket.id}`);
      
      socket.emit("gameInitialized", {
        hand: playerHand,
        topCard: sala.gameState.topCard,
        players: sala.gameState.players.map((p, idx) => {
          const playerInfo = sala.players.find(sp => sp.id === p.id);
          return {
            id: p.id,
            cardCount: p.cardCount,
            name: playerInfo?.name || `Jogador ${idx + 1}`,
            unoGuard: p.unoGuard || false
          };
        }),
        currentPlayerIndex: sala.gameState.currentPlayerIndex,
        direction: sala.gameState.direction,
        declaredColor: sala.gameState.declaredColor
      });
    });

    socket.on("disconnect", () => {
      console.log("Cliente desconectado:", socket.id);
      clientSockets = clientSockets.filter(s => s.id !== socket.id);
      
      // Marca jogador como desconectado com grace period de 30 segundos
      rooms.forEach(sala => {
        if (sala.players) {
          const playerIndex = sala.players.findIndex(p => p.id === socket.id);
          if (playerIndex !== -1) {
            const player = sala.players[playerIndex];
            
            // Marca como desconectado (não remove ainda)
            player.disconnected = true;
            player.disconnectTime = Date.now();
            
            console.log(`⏳ ${player.name} desconectou. Grace period: 30s`);
            
            // Cancela contagem se houver
            if (sala.countdown) {
              clearInterval(sala.countdown);
              sala.countdown = null;
              io.to(`sala_${sala.id}`).emit("countdownCancelled");
            }
            
            // Notifica outros jogadores
            io.to(`sala_${sala.id}`).emit("roomUpdate", {
              players: sala.players,
              roomName: sala.nome
            });
            
            // Timeout de 30 segundos antes de remover definitivamente
            player.disconnectTimeout = setTimeout(() => {
              // Verifica se ainda está desconectado
              if (player.disconnected) {
                console.log(`⏰ Removendo ${player.name} por timeout (30s)`);
                
                // Remove de sala.players
                const currentIndex = sala.players.findIndex(p => p.id === socket.id);
                if (currentIndex !== -1) {
                  sala.players.splice(currentIndex, 1);
                }
                
                // Remove de gameState.players se estava em jogo
                if (sala.gameState) {
                  const gamePlayerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
                  if (gamePlayerIndex !== -1) {
                    sala.gameState.players.splice(gamePlayerIndex, 1);
                    
                    // Ajusta currentPlayerIndex se necessário
                    if (sala.gameState.players.length > 0) {
                      if (sala.gameState.currentPlayerIndex >= sala.gameState.players.length) {
                        sala.gameState.currentPlayerIndex = 0;
                      }
                    } else {
                      // Sem jogadores, encerra jogo
                      sala.gameState = null;
                    }
                    
                    // Envia atualização do jogo
                    io.to(`sala_${sala.id}`).emit("gameUpdate", {
                      topCard: sala.gameState?.topCard,
                      declaredColor: sala.gameState?.declaredColor,
                      players: sala.gameState?.players.map((p) => {
                        const playerInfo = sala.players.find(sp => sp.id === p.id);
                        return {
                          id: p.id,
                          cardCount: p.cardCount,
                          name: playerInfo?.name || 'Jogador',
                          unoGuard: p.unoGuard || false
                        };
                      }) || [],
                      currentPlayerIndex: sala.gameState?.currentPlayerIndex || 0,
                      direction: sala.gameState?.direction || 1
                    });
                  }
                }
                
                // Atualiza sala
                io.to(`sala_${sala.id}`).emit("roomUpdate", {
                  players: sala.players,
                  roomName: sala.nome
                });
                
                // Remove sala se ficou vazia (memory leak fix)
                if (sala.players.length === 0) {
                  const roomIndex = rooms.findIndex(r => r.id === sala.id);
                  if (roomIndex !== -1) {
                    rooms.splice(roomIndex, 1);
                    console.log(`🗑️ Sala ${sala.nome} removida (vazia)`);
                  }
                }
                
                // Atualiza lista de salas no lobby
                const roomsInfo = rooms.map(r => ({
                  id: r.id,
                  nome: r.nome,
                  playerCount: r.players?.length || 0,
                  isPlaying: r.gameState !== null
                }));
                io.emit("updateRooms", { rooms: roomsInfo });
              }
            }, 30000); // 30 segundos
          }
        }
      });
    });
  });
}

function startCountdown(sala, idSala, io) {
  let seconds = 5;
  io.to(`sala_${idSala}`).emit("countdownUpdate", seconds);
  
  sala.countdown = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      io.to(`sala_${idSala}`).emit("countdownUpdate", seconds);
    } else {
      clearInterval(sala.countdown);
      sala.countdown = null;
      
      // Validação final: mínimo 2 jogadores (podem ter desconectado durante countdown)
      if (sala.players.length < 2) {
        console.log(`⚠️ Jogo cancelado: menos de 2 jogadores na sala ${sala.nome}`);
        io.to(`sala_${idSala}`).emit("countdownCancelled");
        io.to(`sala_${idSala}`).emit("erro", "Jogo cancelado: mínimo 2 jogadores necessários");
        return;
      }
      
      console.log('========================================');
      console.log('INICIANDO JOGO NA SALA:', sala.nome);
      console.log('========================================');
      
      // Inicializa o jogo
      const playerIds = sala.players.map(p => p.id);
      console.log('IDs dos jogadores:', playerIds);
      
      sala.gameState = initializeGame(playerIds);
      console.log('Game state criado:', {
        jogadores: sala.gameState.players.length,
        cartasNoBaralho: sala.gameState.deck.length,
        topCard: sala.gameState.topCard,
        currentPlayerIndex: sala.gameState.currentPlayerIndex
      });
      
      // Envia estado inicial do jogo para todos os jogadores
      sala.players.forEach((player, index) => {
        const playerHand = sala.gameState.players[index].hand;
        console.log(`Enviando gameInitialized para ${player.nome} (${player.id}):`, {
          cartasNaMao: playerHand.length,
          topCard: sala.gameState.topCard.color + ' ' + sala.gameState.topCard.value
        });
        
        io.to(player.id).emit("gameInitialized", {
          hand: playerHand,
          topCard: sala.gameState.topCard,
          players: sala.gameState.players.map((p) => {
            const playerInfo = sala.players.find(sp => sp.id === p.id);
            return {
              id: p.id,
              cardCount: p.cardCount,
              name: playerInfo?.name || 'Jogador',
              unoGuard: p.unoGuard || false
            };
          }),
          currentPlayerIndex: sala.gameState.currentPlayerIndex,
          direction: sala.gameState.direction,
          declaredColor: sala.gameState.declaredColor
        });
      });
      
      console.log('Emitindo gameStart para sala_' + idSala);
      io.to(`sala_${idSala}`).emit("gameStart");
      console.log(`✅ Jogo iniciado na sala ${sala.nome}`);
      console.log('========================================');
      
      // Atualiza lista de salas no lobby (jogo começou)
      const roomsInfo = rooms.map(r => ({
        id: r.id,
        nome: r.nome,
        playerCount: r.players?.length || 0,
        isPlaying: r.gameState !== null
      }));
      io.emit("updateRooms", { rooms: roomsInfo });
    }
  }, 1000);
}