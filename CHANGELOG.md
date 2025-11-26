# CHANGELOG

Todas as mudanças relevantes no protótipo UnoSemiOnline.

## 2025-11-26 — Melhorias e correções

- feat: Detectar condição de vitória
  - Quando um jogador fica com 0 cartas o servidor emite `game_over` com `{ winnerId }`.
  - Ao detectar vitória, o jogo atual é finalizado (estado limpo) — um novo jogo só pode ser iniciado novamente pela tela principal (criador da sala).

- feat: Timer para alerta UNO
  - Ao detectar que um jogador ficou com 1 carta, o servidor cria um `uno_alert` e inicia um timer (7s).
  - Se ninguém pressionar UNO antes do timer expirar, o alerta é resolvido automaticamente sem penalidade (emite `uno_resolved` com `penalty: false`).
  - Se outro jogador pressionar UNO antes do timeout, o dono recebe a penalidade (compra 2 cartas) e o servidor emite `uno_resolved` com `penalty: true`.

- fix: Restringir início do jogo
  - Somente o criador da sala (owner) pode iniciar um novo jogo via `start_game`.
  - Tentativas não autorizadas de iniciar jogo retornam erro.

- docs: Adicionado este arquivo `CHANGELOG.md` para documentar alterações futuras.

## 2025-11-26 — UI: Modal de vitória, tela de join e mensagens de espera

- feat: Modal de vitória na mesa principal (`pages/index.js`)
  - Ao receber `game_over` o cliente exibe um modal com o `winnerId` e volta ao estado de espera (permitindo iniciar um novo jogo pela tela principal).

- feat: Modal de vitória e mensagem de espera na tela do jogador (`pages/player/[code].js`)
  - Jogadores veem uma mensagem "Aguarde o início do jogo..." após entrar na sala e antes do `start_game`.
  - Ao receber `game_over` o jogador vê o modal de vitória e retorna ao estado de espera.

- feat: Página de entrada de código (`/join`)
  - Nova página `pages/join.js` que pede o código da sala e redireciona para `/player/<CODE>`.
  - Se o navegador for um dispositivo móvel e a URL contiver `?code=XXXXX`, a página redireciona automaticamente para a tela do jogador.




> Observações:
> - Persistência ainda é em memória (não escalável).
> - Recomenda-se revisar `pendingDraw` e edge-cases com 2 jogadores em próxima iteração.

## 2025-11-26 — Gameplay: comprar passa a vez + melhor contraste das cartas

- feat: Ao comprar carta (ação normal), o jogador perde a vez
  - Quando um jogador solicita `draw_card` (com count > 0) durante sua vez, o servidor aplica a compra e avança a vez para o próximo jogador.

- fix: Melhor contraste nas cartas amarelas
  - `components/Card.js` e a renderização da mão em `pages/player/[code].js` agora usam texto escuro em cartas amarelas e mapeiam cores para tons hexadecimais para melhor legibilidade.
 
- feat: Validação de integridade do baralho
  - O servidor agora registra o tamanho inicial do baralho (108 cartas) em `initGame` e valida, após operações críticas (`drawCards`, `playCard`), que a soma das cartas em `deck`, `discard` e mãos dos jogadores permaneça igual ao tamanho inicial.
  - Se for detectada uma discrepância a função lança `deck_integrity_error`, protegendo contra estados inválidos ou clientes maliciosos que criem cartas fora do inventário.
  - Essa validação não altera a jogabilidade normal — é uma proteção adicional. Testes de simulação foram executados para validar comportamento.
 
## 2025-11-26 — UI: modal de vitória imediato e remoção de alert() do UNO

- fix: Mostrar modal de vitória imediatamente
  - O modal de vitória agora é renderizado mesmo quando o estado do jogo está limpo, garantindo que jogadores vejam o anúncio assim que o servidor emitir `game_over`.

- fix: Remover alert() para eventos UNO
  - Chamadas a `alert()` que eram disparadas em `uno_resolved` foram removidas da `pages/index.js` e `pages/player/[code].js` para evitar caixas de diálogo intrusivas.


