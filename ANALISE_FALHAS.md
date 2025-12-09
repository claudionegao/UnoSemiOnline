# 🔴 ANÁLISE DE FALHAS CRÍTICAS - UnoSemiOnline

**Data da Análise:** 09 de dezembro de 2025  
**Escopo:** Projeto completo (sem consideração de persistência de dados)  
**Total de Falhas Identificadas:** 11 (8 críticas + 3 moderadas)

---

## 📋 RESUMO EXECUTIVO

O projeto apresenta falhas arquiteturais significativas que comprometem a jogabilidade, especialmente em cenários com desconexões e transições entre lobby/jogo. As falhas mais críticas envolvem:

1. Handlers duplicados que sobrescrevem funcionalidade
2. Falta de sincronização entre `sala.players` e `gameState.players`
3. Problemas de reconexão durante jogo
4. Transição insegura entre lobby e tela de jogo
5. Race conditions no início do jogo

---

## 🔴 FALHAS CRÍTICAS

### **FALHA #1: Evento `acceptDrawPenalty` Não Existe no Servidor**

**Arquivo:** `pages/game/[id].js` (linha ~731)  
**Tipo:** Código Faltando  
**Severidade:** 🔴 CRÍTICA

**Descrição:**
O cliente emite um evento que o servidor nunca recebe:
```javascript
// Cliente
socket.emit('acceptDrawPenalty', id, (response) => { ... })
```

Mas no servidor (`pages/api/socket.js`), não existe handler para `acceptDrawPenalty`. O servidor espera `callUno` para tudo.

**Impacto:**
- Quando um jogador tenta aceitar penalidade de draw (não defender), fica travado
- A aplicação não responde ao callback
- Jogo fica em estado inconsistente

**Como Reproduzir:**
1. Iniciar jogo com 2 jogadores
2. Jogador A joga carta +2
3. Jogador B clica em "Comprar 2 cartas" (ao invés de defender)
4. Nada acontece, jogador fica travado

**Solução Proposta:**
Renomear o primeiro `callUno` para `acceptDrawPenalty` ou criar novo handler específico.

---

### **FALHA #2: Segundo Handler `callUno` Sobrescreve o Primeiro**

**Arquivo:** `pages/api/socket.js` (linhas 664 e 724)  
**Tipo:** Sobrescrita de Handler  
**Severidade:** 🔴 CRÍTICA

**Descrição:**
Existem dois handlers `socket.on("callUno", ...)` no mesmo escopo:

```javascript
// PRIMEIRO handler (linha 664) - para aceitar penalidade
socket.on("callUno", (roomId, callback) => {
  if (!sala.gameState.waitingForDefense || sala.gameState.defensePlayerId !== socket.id) {
    // Rejeita se não está esperando defesa
    return;
  }
  applyDrawPenalty(...);
});

// SEGUNDO handler (linha 724) - para acusar ou ativar UNO Guard
socket.on("callUno", (roomId, callback) => {
  // Ativa UNO Guard OU acusa outros
});
```

**Impacto:**
- O primeiro handler é completamente ignorado
- Impossível aceitar penalidade de draw
- UNO Guard não funciona corretamente em contexto de defesa

**JavaScript Behavior:**
Em JavaScript, quando você registra dois listeners com o mesmo nome, **o segundo NÃO sobrescreve o primeiro, ambos são chamados**. Porém, isso causa ambiguidade e race conditions.

**Solução Proposta:**
Renomear o primeiro para `acceptDrawPenalty` e criar lógica clara:
- `acceptDrawPenalty`: Jogador aceita comprar durante defesa
- `callUno`: Ativar UNO Guard OU acusar outros

---

### **FALHA #3: Reconexão em Jogo é Bloqueada**

**Arquivo:** `pages/api/socket.js` (linhas 160-175)  
**Tipo:** Lógica de Negócio  
**Severidade:** 🔴 CRÍTICA

**Descrição:**
Quando `entrarSala` é chamado e o jogo já está em andamento:

```javascript
socket.on("entrarSala", (idSala, nome, callback) => {
  const sala = rooms.find(room => room.id == idSala);
  if (sala) {
    // Verifica se o jogo está acontecendo
    if (sala.gameState !== null) {
      console.log(`Sala ${idSala} está em jogo, entrada bloqueada`);
      socket.emit("erro", "Não é possível entrar, o jogo já começou");
      if (callback) callback(null);
      return; // ← BLOQUEIA ENTRADA
    }
  }
});
```

**Problema:**
Se um jogador desconectar DURANTE o jogo (não na lobby), não consegue se reconectar. A lógica só permite entrada quando `gameState === null`.

**Impacto:**
- Desconexão durante jogo = perda permanente (a menos que espere 30s para ser removido)
- Grace period de 30s não ajuda (jogador está marcado como desconectado)
- Experiência de jogo muito frágil

**Como Reproduzir:**
1. Iniciar jogo com 2 jogadores
2. Fechar aba/desconectar um jogador propositalmente
3. Tentar reconectar com mesmo nome
4. Recebe erro: "Não é possível entrar, o jogo já começou"

**Solução Proposta:**
Diferenciar entre:
- Novo jogador tentando entrar em jogo em andamento → Bloquear ✓
- Jogador que estava em jogo reconectando → Permitir e restaurar estado ✓

---

### **FALHA #4: Transição Lobby → Jogo Causa Desincronização de Socket.IO**

**Arquivo:** `pages/[id].js` (linha ~167) + `pages/game/[id].js` (linha ~550)  
**Tipo:** Integridade de Conexão  
**Severidade:** 🔴 CRÍTICA

**Descrição:**
Ao navegar de lobby para jogo:

```javascript
// pages/[id].js - Lobby
socket.on('gameStart', () => {
  router.push(`/game/${id}?name=${nome}`);
});

// pages/game/[id].js - Tela do Jogo
useEffect(() => {
  const socket = getSocket(); // ← NOVO socket ou reutilizado?
  socket.on('connect', () => {
    console.log('Socket conectado! ID:', socket.id);
    // NÃO entra na sala aqui!
  });
}, [id, name]);
```

**Problema:**
1. `getSocket()` em `lib/socket.js` reutiliza instância se existir
2. MAS se houver delay, ou novo navegador, cria socket NOVO
3. Socket novo tem ID diferente do antigo
4. Servidor não reconhece este novo socket como parte do jogo

**Impacto:**
- Jogador aparece em `sala.players` mas não em `gameState.players`
- Handlers de jogo (`playCard`, `drawCard`) falham com "Jogador não encontrado"
- Jogo travado para este jogador

**Como Reproduzir:**
1. Abrir dev tools → Network tab
2. Iniciar jogo
3. Observar socket ID antes e depois da transição
4. Pode haver ID diferente

**Solução Proposta:**
- Garantir socket entra na sala Socket.IO (`socket.join()`) na tela do jogo
- Ou passar socket ID via URL/localStorage e validar no servidor

---

### **FALHA #5: Race Condition no `startCountdown`**

**Arquivo:** `pages/api/socket.js` (linhas 1000-1010)  
**Tipo:** Condição de Corrida  
**Severidade:** 🔴 CRÍTICA

**Descrição:**
No momento exato em que o countdown termina e o jogo inicia:

```javascript
function startCountdown(sala, idSala, io) {
  let seconds = 5;
  sala.countdown = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      io.to(`sala_${idSala}`).emit("countdownUpdate", seconds);
    } else {
      clearInterval(sala.countdown);
      
      // ← AQUI PODE HAVER RACE CONDITION
      const playerIds = sala.players.map(p => p.id);
      sala.gameState = initializeGame(playerIds);
      
      sala.players.forEach((player, index) => {
        const playerHand = sala.gameState.players[index].hand;
        io.to(player.id).emit("gameInitialized", { hand: playerHand, ... });
      });
    }
  }, 1000);
}
```

**Problema:**
Entre `map(p => p.id)` e `initializeGame()`, um jogador pode:
- Sair da sala (sairSala handler remove de `sala.players`)
- Desconectar (disconnect handler marca como desconectado)

Resultado: `playerIds` tem ID de jogador que já não existe em `sala.players`!

**Impacto:**
- Mismatch: `gameState.players` tem ID que não está em `sala.players`
- `gameUpdate` envia informações de jogadores inexistentes
- Índices desincronizados
- Crash ao tentar buscar nome do jogador: `sala.players.find(sp => sp.id === p.id)` retorna `undefined`

**Como Reproduzir:**
1. 3 jogadores em sala
2. Todos clicam "Pronto"
3. Countdown começou
4. Antes de terminar, 1 jogador clica "Sair"
5. Jogo inicia mesmo assim, com inconsistência

**Solução Proposta:**
- Fazer snapshot de `sala.players` antes de iniciar countdown
- Ou adicionar lock/travamento para evitar saídas durante countdown

---

### **FALHA #6: Mismatch Entre `sala.players` e `gameState.players`**

**Arquivo:** Todo o servidor (`pages/api/socket.js`)  
**Tipo:** Integridade de Dados  
**Severidade:** 🔴 CRÍTICA

**Descrição:**
Existem dois registros paralelos de jogadores:
1. `sala.players` - Lista de jogadores na sala (com status ready, desconectado, etc)
2. `gameState.players` - Lista de jogadores no jogo (com mão, cartCount, UNO Guard)

Eles **devem estar sincronizados**, mas não estão:

**Cenários de Desincronização:**

**Cenário A:** Ao remover jogador
```javascript
// Em sairSala
sala.players.splice(playerIndex, 1);  // Remove de sala

if (sala.gameState) {
  const gamePlayerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
  if (gamePlayerIndex !== -1) {
    sala.gameState.players.splice(gamePlayerIndex, 1); // Remove de game
  }
}
```
✓ Parece sincronizado, MAS não há lock, então race condition é possível.

**Cenário B:** Ao processar jogada
```javascript
// Em playCard
io.to(`sala_${roomId}`).emit("gameUpdate", {
  players: sala.gameState.players.map((p) => {
    const playerInfo = sala.players.find(sp => sp.id === p.id);  // ← Pode retornar undefined!
    return {
      id: p.id,
      name: playerInfo?.name || 'Jogador',  // Fallback para 'Jogador'
    };
  }),
});
```

Se jogador foi removido de `sala.players` mas ainda está em `gameState.players`, será mostrado com nome "Jogador".

**Cenário C:** Reconexão
```javascript
// Em entrarSala - reconexão com novo ID
player.id = socket.id;  // Atualiza em sala.players
// MAS gameState.players ainda aponta para ID antigo!
```

**Impacto:**
- UI desincronizada com servidor
- Nomes incorretos de jogadores
- Contadores de cartas errados
- Crashes quando tenta acessar `sala.players.find(...)`

**Solução Proposta:**
- Implementar função sincronização central
- Ou usar estrutura de dados única (não duas listas paralelas)
- Ou usar índices ao invés de IDs

---

### **FALHA #7: Socket Não Entra na Sala Durante Jogo**

**Arquivo:** `pages/game/[id].js` (linha ~550-560)  
**Tipo:** Setup de Comunicação  
**Severidade:** 🔴 CRÍTICA

**Descrição:**
Na página do jogo, o socket conecta mas NÃO entra na sala Socket.IO:

```javascript
// pages/game/[id].js
useEffect(() => {
  const socket = getSocket();
  
  socket.on('connect', () => {
    console.log('Socket conectado! ID:', socket.id);
    // ← FALTA socket.join(`sala_${id}`)!
  });
  
  // Se já estiver conectado
  if (socket.connected) {
    console.log('Socket já conectado');
    // ← FALTA socket.join(`sala_${id}`)!
  }
  
  // Registra listeners
  socket.on('gameInitialized', ...);
  socket.on('gameUpdate', ...);
  
  // Solicita estado
  socket.emit('requestGameState', id);
}, [id, name]);
```

**Problema:**
Socket não chama `socket.join()`. Sem isso:
- Socket não está na sala `sala_${id}` do Socket.IO
- Eventos broadcast `io.to('sala_${id}').emit(...)` não chegam a este socket
- Servidor emite `gameUpdate`, mas cliente não recebe

**Impacto:**
- Jogador não recebe atualizações de jogo
- Modal de defesa não aparece
- UNO Guard não sincroniza
- Jogo não inicia para este jogador

**Solução Proposta:**
Adicionar `socket.join('sala_${id}')` em dois pontos:
1. Quando socket conecta
2. Se já está conectado

---

### **FALHA #8: Acúmulo de Timers de Desconexão (Memory Leak)**

**Arquivo:** `pages/api/socket.js` (linhas 930-970)  
**Tipo:** Memory Leak  
**Severidade:** 🔴 CRÍTICA

**Descrição:**
Cada vez que um jogador desconecta, um timeout é criado:

```javascript
socket.on("disconnect", () => {
  rooms.forEach(sala => {
    if (sala.players) {
      const playerIndex = sala.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = sala.players[playerIndex];
        player.disconnected = true;
        
        // Cria timeout
        player.disconnectTimeout = setTimeout(() => {
          // Remove após 30s
        }, 30000);
      }
    }
  });
});
```

**Problema:**
Se jogador reconecta durante grace period:
```javascript
if (player.disconnectTimeout) {
  clearTimeout(player.disconnectTimeout);
  player.disconnectTimeout = null;  // ← Cancela anterior
}
```

MAS se houver **bug de reconexão infinita** (ping/pong quebrando):
- Desconecta → cria timeout
- Conecta → cancela timeout
- Desconecta → cria timeout NOVO
- Loop infinito → acumula timeouts

Com 1000 reconexões = 1000 timeouts em memória não executados, mas ocupando RAM.

**Impacto:**
- Memory leak gradual
- Servidor degrada com tempo
- Pode causar crash em produção

**Como Reproduzir:**
Usar dev tools para simular perda de conexão múltiplas vezes rapidamente.

**Solução Proposta:**
- Garantir limpeza com `clearTimeout` em `entrarSala` também
- Implementar máximo de timeouts por jogador
- Usar WeakMap para auto-cleanup

---

## 🟠 FALHAS MODERADAS

### **FALHA #9: Socket.ID Muda na Reconexão, ID em `gameState` Desatualizado**

**Arquivo:** `pages/api/socket.js` (linhas 192-210)  
**Tipo:** Sincronização de ID  
**Severidade:** 🟠 MODERADA

**Descrição:**
Quando jogador reconecta com novo socket ID:

```javascript
// Reconexão detectada por nome
if (disconnectedPlayerIndex !== -1) {
  const player = sala.players[disconnectedPlayerIndex];
  const oldSocketId = player.id;
  
  player.id = socket.id;  // ← Atualiza em sala.players
  // MAS gameState ainda aponta para oldSocketId!
}
```

Depois, ao tentar jogar:
```javascript
const playerIndex = sala.gameState.players.findIndex(p => p.id === socket.id);
// Busca com socket.id novo, mas gameState tem oldSocketId
// Resultado: playerIndex === -1, erro!
```

**Impacto:**
- Jogador não consegue fazer ações após reconectar
- "Jogador não encontrado" em todos os handlers

**Solução Proposta:**
Atualizar `gameState.players` também:
```javascript
if (sala.gameState) {
  const gamePlayer = sala.gameState.players.find(p => p.id === oldSocketId);
  if (gamePlayer) {
    gamePlayer.id = socket.id;
  }
}
```

---

### **FALHA #10: `currentPlayerIndex` Pode Ficar Inválido Após Remover Jogador**

**Arquivo:** `pages/api/socket.js` (múltiplos handlers)  
**Tipo:** Índice Inválido  
**Severidade:** 🟠 MODERADA

**Descrição:**
Ao remover jogador:

```javascript
sala.gameState.players.splice(gamePlayerIndex, 1);

// Ajusta currentPlayerIndex
if (sala.gameState.currentPlayerIndex >= sala.gameState.players.length) {
  sala.gameState.currentPlayerIndex = 0;
}
```

**Problema:**
Se remover jogador ANTES desta verificação, ou se houver race condition:
- `currentPlayerIndex` aponta para jogador que não existe
- Próxima ação falha ao buscar `gameState.players[currentPlayerIndex]`

Exemplo:
- 3 jogadores, `currentPlayerIndex = 2`
- Remove jogador no índice 1
- Agora só há 2 jogadores (índices 0, 1)
- `currentPlayerIndex = 2` é inválido!

**Impacto:**
- Próxima jogada entra em erro
- Jogo fica travado

**Solução Proposta:**
Usar `currentPlayerIndex >= length` check ANTES de qualquer operação.

---

### **FALHA #11: UNO Guard Removido Mas Não Sincronizado**

**Arquivo:** `pages/api/socket.js` (linha 549)  
**Tipo:** Estado Desincronizado  
**Severidade:** 🟠 MODERADA

**Descrição:**
Ao comprar carta, UNO Guard é removido:

```javascript
socket.on("drawCard", (roomId, callback) => {
  // ...
  if (player.unoGuard) {
    player.unoGuard = false;
    console.log(`🚫 UNO Guard removido do jogador ${player.id}`);
  }
  
  // Avança turno
  sala.gameState.currentPlayerIndex = ...;
  
  // ← AQUI ENVIA gameUpdate, MAS SEM SINCRONIZAR unoGuard ANTES
  io.to(`sala_${roomId}`).emit("gameUpdate", {
    players: sala.gameState.players.map((p) => ({
      unoGuard: p.unoGuard || false
    })),
  });
});
```

**Problema:**
Se houver delay ou race condition, outros jogadores veem badge de UNO Guard desatualizado.

**Impacto:**
- UI mostra "🛡️" mesmo após jogador comprar carta
- Pode levar a acusações incorretas
- Confusão entre jogadores

**Solução Proposta:**
Sincronizar imediatamente após remover:
```javascript
if (player.unoGuard) {
  player.unoGuard = false;
  io.to(`sala_${roomId}`).emit("gameUpdate", { ... }); // Sync imediato
}
```

---

## 📊 TABELA RESUMIDA

| # | Falha | Arquivo | Tipo | Severidade | Estimado | Prioridade |
|---|-------|---------|------|-----------|----------|-----------|
| 1 | acceptDrawPenalty não existe | game/[id].js | Código faltando | 🔴 | 2 min | 🔥 |
| 2 | Duplo callUno | api/socket.js | Sobrescrita | 🔴 | 5 min | 🔥 |
| 3 | Reconexão em jogo bloqueada | api/socket.js | Lógica | 🔴 | 15 min | 🔥 |
| 4 | Socket novo na transição | [id].js + game/[id].js | Setup | 🔴 | 10 min | 🔥 |
| 5 | Race condition countdown | api/socket.js | Timing | 🔴 | 10 min | 🔥 |
| 6 | Mismatch sala/gameState | api/socket.js | Integridade | 🔴 | 30 min | 🔥 |
| 7 | Socket não entra na sala | game/[id].js | Comunicação | 🔴 | 5 min | 🔥 |
| 8 | Memory leak timers | api/socket.js | Vazamento | 🔴 | 10 min | 🟡 |
| 9 | Socket.id muda | api/socket.js | ID | 🟠 | 5 min | 🟡 |
| 10 | currentPlayerIndex inválido | api/socket.js | Índice | 🟠 | 5 min | 🟡 |
| 11 | unoGuard não sincronizado | api/socket.js | Estado | 🟠 | 3 min | 🟡 |

---

## 🛠️ ORDEM RECOMENDADA DE CORREÇÃO

### **Fase 1 - Reparos Rápidos (15 minutos)**
1. **Falha #2** - Remover/renomear duplo callUno
2. **Falha #1** - Criar handler acceptDrawPenalty
3. **Falha #7** - Adicionar socket.join() em game/[id].js
4. **Falha #11** - Sincronizar unoGuard imediatamente

### **Fase 2 - Refactorings Médios (30 minutos)**
5. **Falha #9** - Atualizar gameState.players ao reconectar
6. **Falha #10** - Validar currentPlayerIndex em todos os handlers
7. **Falha #8** - Melhorar limpeza de timers

### **Fase 3 - Refactoring Major (45+ minutos)**
8. **Falha #6** - Refactor sala/gameState sincronização
9. **Falha #5** - Adicionar lock durante countdown
10. **Falha #4** - Garantir transição segura lobby→jogo
11. **Falha #3** - Implementar reconexão em jogo

---

## 📝 NOTAS PARA AMANHÃ

- [ ] Começar pela Fase 1 (reparos rápidos)
- [ ] Testar cada fix com 2-3 jogadores
- [ ] Simular desconexões durante cada fase
- [ ] Considerar adicionar logs para debugging
- [ ] Documentar cada fix em commit separado

