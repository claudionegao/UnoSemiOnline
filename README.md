# UnoSemiOnline - Prototype

Este repositório contém um protótipo básico de um jogo UNO online usando Next.js e Socket.IO.

Como usar

1. Instale dependências:

```bash
npm install
```

2. Rode em modo desenvolvimento:

```bash
npm run dev
```

3. Abra um navegador no `http://localhost:3000` para ver a mesa.
4. Abra outro navegador (ou celular) em `http://localhost:3000/player/<CODIGO>` — ou crie/entre em sala pela mesa e use o código exibido.

O protótipo inclui:
- Lógica de baralho e regras básicas em `lib/game.js`.
- WebSocket via `pages/api/socket.js` (Socket.IO).
- Tela da mesa em `pages/index.js`.
- Tela do jogador em `pages/player/[code].js`.

Observações e próximos passos
- A persistência é em memória (não escalável).
- Falta tratamento completo de efeitos e verificações de regras complexas.
- Implementar som `ping.mp3`, melhorar UI, e bloquear ações inválidas.
# UnoSemiOnline