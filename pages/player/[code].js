import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Card from '../../components/Card';

export default function PlayerView() {
  const router = useRouter();
  const { code } = router.query;
  const [socket, setSocket] = useState(null);
  const [state, setState] = useState(null);
  const [playersList, setPlayersList] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [name, setName] = useState('');
  const [unoAlert, setUnoAlert] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerId, setWinnerId] = useState(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const lastAutoActionRef = useRef(null);
  const lastSeenCurrentRef = useRef(null);
  const latestStateRef = useRef(null);

  useEffect(() => {
    if (!code) return;
    let s;
    import('socket.io-client').then(({ io }) => {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
      // if NEXT_PUBLIC_SOCKET_URL is set (external socket server), connect to it;
      // otherwise connect to the same origin API route used in local dev
      s = io(socketUrl, { path: socketUrl ? undefined : '/api/socket' });
      setSocket(s);

      // attempt automatic rejoin if we have a stored playerId for this room
      try {
        const stored = window.localStorage.getItem(`uno_player_${code}`);
        if (stored) {
          setPlayerId(stored);
          // join with stored id and request current state
          s.emit('join_room', { code, playerId: stored, name: stored }, (res) => {
            s.emit('get_state', { code }, (r) => { if (r.state) setState(r.state); });
          });
        }
      } catch (e) {
        // ignore localStorage errors
      }

      s.on('state_update', st => {
        latestStateRef.current = st;
        setState(st);
      });

      s.on('player_joined', ({ players }) => setPlayersList(players || []));
      s.on('player_disconnected', ({ playerId }) => {
        // if we're in the lobby view, remove from playersList; otherwise state_update will reflect it
        setPlayersList(prev => prev.filter(p => p !== playerId));
      });
      s.on('uno_alert', ({ ownerId }) => setUnoAlert({ ownerId }));
      s.on('uno_resolved', (info) => { setUnoAlert(null); /* removed alert box for UNO */ });
      s.on('game_over', ({ winnerId }) => {
        // show modal and return player to waiting state
        setWinnerId(winnerId);
        setShowWinnerModal(true);
        setState(null);
      });
    });

    return () => { if (s) s.close(); };
  }, [code]);

  useEffect(() => {
    if (!state || !playerId) return;
    const idx = state.players.findIndex(p => p.id === playerId);
    if (idx === state.current) {
      // é sua vez -> tocar som via WebAudio
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 880;
        g.gain.value = 0.0015;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        o.stop(ctx.currentTime + 0.6);
      } catch (e) {
        // fallback para <audio>
        if (audioRef.current) audioRef.current.play().catch(()=>{});
      }
    }
  }, [state, playerId]);

  // Auto-action: if it's your turn and the only options are to draw or accept penalty, do it once
  useEffect(() => {
    if (!state || !playerId || !socket) {
      // debug
      console.log('[auto-action] skipping because missing', { hasState: !!state, playerId, hasSocket: !!socket });
      return;
    }

    console.log('[auto-action] evaluating', { playerId, current: state.current, players: state.players.map(p=>({id:p.id, name:p.name, hand:p.hand.length})) });

    const myIdx = state.players.findIndex(p => p.id === playerId);
    if (myIdx === -1) return; // not in players
    if (myIdx !== state.current) return; // not your turn

    const pending = state.pendingDraw || { type: null, amount: 0 };
    const myHand = state.players[myIdx].hand || [];
    const hasPlayable = myHand.some(isCardPlayable);

    // reset auto-action marker when turn index changes
    if (lastSeenCurrentRef.current !== state.current) {
      lastAutoActionRef.current = null;
      lastSeenCurrentRef.current = state.current;
    }

    // If we've already auto-acted for this current turn, skip
    if (lastAutoActionRef.current === state.current) return;

    // If no playable cards, automatically draw or accept penalty after a short delay
    if (!hasPlayable) {
      // schedule action after slight delay to avoid racing with in-flight updates
      const timer = setTimeout(() => {
        try {
          if (!socket) return;
          // get freshest state from ref (avoid stale closure)
          const fresh = latestStateRef.current || state;
          const curIdx = (fresh.players || []).findIndex(p => p.id === playerId);
          if (curIdx !== fresh.current) {
            console.log('[auto-action] aborted - turn changed', { curIdx, expected: fresh.current });
            return;
          }

          lastAutoActionRef.current = fresh.current;
          const actionMsg = pending.amount > 0 ? `accept ${pending.amount}` : 'draw 1';
          // send debug log to server
          try { socket.emit('client_log', { code, level: 'info', msg: `[auto-action] ${actionMsg}`, meta: { playerId, turn: state.current } }); } catch (e) {}
          console.log('[auto-action] performing', { actionMsg, playerId, turn: state.current, pending });

          if (pending.amount > 0) {
            // accept penalty
            resolvePendingDraw();
          } else {
            // draw one card
            draw();
          }
        } catch (e) {
          try { socket.emit('client_log', { code, level: 'error', msg: '[auto-action] error', meta: { err: e && e.message } }); } catch (e) {}
        }
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [state, playerId, socket]);

  // Reset auto-action markers when game ends or is not present, so automation can run for new games
  useEffect(() => {
    if (!state) {
      lastAutoActionRef.current = null;
      lastSeenCurrentRef.current = null;
      if (socket && socket.emit) socket.emit('client_log', { code, level: 'info', msg: '[auto-action] reset markers because state is null' });
    }
  }, [state]);

  function join() {
    const id = name || `P-${Math.floor(Math.random()*1000)}`;
    setPlayerId(id);
    try { window.localStorage.setItem(`uno_player_${code}`, id); } catch(e) {}
    socket.emit('join_room', { code, playerId: id, name: id }, (res) => {
      // after join ask for state
      socket.emit('get_state', { code }, (r) => { if (r.state) setState(r.state); });
    });
  }

  function startGame() {
    if (!socket) return;
    socket.emit('start_game', { code }, (res) => {
      if (res && res.error) alert(res.error);
    });
  }

  function play(card) {
    socket.emit('play_card', { code, playerId, card }, (res) => { if (res && res.error) alert(res.error); });
  }

  function playWithColor(card, color) {
    if (!socket) return;
    socket.emit('play_card', { code, playerId, card, chosenColor: color }, (res) => {
      if (res && res.error) alert(res.error);
    });
    setShowColorPicker(false);
    setSelectedCard(null);
  }

  function handleCardClick(card) {
    if (!state || !playerId || !socket) return;
    const myIdx = state.players.findIndex(p => p.id === playerId);
    const isMyTurn = myIdx === state.current;
    const pending = state.pendingDraw || { type: null, amount: 0 };

    if (!isMyTurn) {
      // não é sua vez
      return;
    }

    if (pending.amount > 0) {
      // existe penalidade pendente: só pode empilhar do mesmo tipo ou resolver
      if (card.type !== pending.type) {
        alert('Existe uma penalidade pendente: só é possível empilhar a mesma carta de compra ou aceitar a penalidade.');
        return;
      }
      // se for do mesmo tipo, permite jogar (empilhar)
    }

    if (card.type === 'wild' || card.type === 'wild_draw4') {
      setSelectedCard(card);
      setShowColorPicker(true);
      return;
    }

    play(card);
  }

  function isCardPlayable(card) {
    if (!state) return false;
    const top = state.discard && state.discard[state.discard.length - 1];
    const pending = state.pendingDraw || { type: null, amount: 0 };
    // if there's a pending draw, only same type can be played to stack
    if (pending.amount > 0) {
      return card.type === pending.type;
    }
    // wilds always playable
    if (card.type === 'wild' || card.type === 'wild_draw4') return true;
    if (!top) return true;
    if (card.color && top.color && card.color === top.color) return true;
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
    if (card.type === top.type && card.type !== 'number') return true;
    return false;
  }

  function draw() {
    // se houver pendingDraw no state, chamar draw_card sem count para que o servidor aplique a penalidade acumulada
    if (!socket) return;
    console.log('[draw] emitting draw_card count=1', { code, playerId });
    try { socket.emit('client_log', { code, level: 'info', msg: '[draw] request draw 1', meta: { playerId } }); } catch(e){}
    const priorCurrent = (latestStateRef.current && latestStateRef.current.current) || (state && state.current);
    socket.emit('draw_card', { code, playerId, count: 1 }, (res) => {
      console.log('[draw] res', res);
      try { socket.emit('client_log', { code, level: 'info', msg: '[draw] response', meta: { res } }); } catch(e){}
      // request fresh state after draw to avoid missed state_update races (with retries)
      try {
        fetchStateWithRetries(priorCurrent).then(() => {});
      } catch(e){}
    });
  }

  // função pra resolver penalidade (quando existe pendingDraw): chama draw_card sem count
  function resolvePendingDraw() {
    if (!socket) return;
    console.log('[resolvePendingDraw] emitting draw_card count=0', { code, playerId });
    try { socket.emit('client_log', { code, level: 'info', msg: '[resolvePendingDraw] request draw 0', meta: { playerId } }); } catch(e){}
    const priorCurrent2 = (latestStateRef.current && latestStateRef.current.current) || (state && state.current);
    socket.emit('draw_card', { code, playerId, count: 0 }, (res) => {
      console.log('[resolvePendingDraw] res', res);
      try { socket.emit('client_log', { code, level: 'info', msg: '[resolvePendingDraw] response', meta: { res } }); } catch(e){}
      // request fresh state after resolving penalty (with retries)
      try {
        fetchStateWithRetries(priorCurrent2).then(() => {});
      } catch(e){}
    });
  }

  // helper to fetch latest state with limited retries when prior current index did not advance
  function fetchStateWithRetries(priorCurrent, maxRetries = 2, delay = 700) {
    return new Promise((resolve) => {
      let attempts = 0;
      const tryFetch = () => {
        socket.emit('get_state', { code }, (r) => {
          if (r && r.state) { latestStateRef.current = r.state; setState(r.state); }
          const newC = r && r.state ? r.state.current : (latestStateRef.current && latestStateRef.current.current);
          if (typeof priorCurrent === 'undefined' || newC !== priorCurrent) return resolve(r && r.state ? r.state : latestStateRef.current);
          attempts++;
          if (attempts > maxRetries) return resolve(r && r.state ? r.state : latestStateRef.current);
          setTimeout(tryFetch, delay);
        });
      };
      tryFetch();
    });
  }

  return (
    <div style={{ minHeight: '100vh', padding: 16 }}>
      <h1>Jogador — Sala {code}</h1>
      {!playerId && (
        <div>
          <input placeholder="Seu nome" value={name} onChange={e=>setName(e.target.value)} />
          <button onClick={join}>Entrar</button>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <p>Gire o celular para modo paisagem (landscape) para melhor experiência.</p>
        <audio ref={audioRef} src="/ping.mp3" />
      </div>

      {/* waiting message shown when there's no active game but player entered */}
      {!state && playerId && (
        <div style={{ marginTop: 12, padding: 12, background: '#eef', borderRadius: 6 }}><strong>Aguarde o início do jogo...</strong></div>
      )}

      {/* enumerated players + start button for first player */}
      {playerId && (
        <div style={{ marginTop: 12 }}>
          <h4>Jogadores conectados</h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {state && state.players ? state.players.map((p, i) => (
              <div key={p.id} style={{ width: 140, minHeight: 56, borderRadius: 8, padding: 8, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: p.connected === false ? '#ddd' : '#5cb85c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{p.name ? p.name.charAt(0).toUpperCase() : '?'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}{p.connected === false ? ' • desconectado' : ''}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{p.hand.length} cartas</div>
                </div>
                <div style={{ fontSize: 11, background: '#f7f7f7', padding: '4px 6px', borderRadius: 6 }}>{i + 1}</div>
              </div>
            )) : playersList.map((p, i) => (
              <div key={i} style={{ width: 140, minHeight: 56, borderRadius: 8, padding: 8, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#8c8c8c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{String(p).charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>aguardando</div>
                </div>
                <div style={{ fontSize: 11, background: '#f7f7f7', padding: '4px 6px', borderRadius: 6 }}>{i + 1}</div>
              </div>
            ))}
          </div>
          {/* show Start button when this player is the first in the list (menor número) and no game active */}
          {playersList.length > 0 && playersList[0] === playerId && !state && (
            <div style={{ marginTop: 8 }}>
              <button onClick={startGame}>Iniciar jogo (você é #1)</button>
            </div>
          )}
        </div>
      )}

      {unoAlert && (
        <div style={{ marginTop: 8 }}>
          {unoAlert.ownerId === playerId ? (
            <div><strong>Você tem apenas 1 carta! Pressione UNO para marcar.</strong><br /><button onClick={() => socket.emit('press_uno', { code, pressedBy: playerId })}>UNO</button></div>
          ) : (
            <div><strong>{unoAlert.ownerId} está com 1 carta!</strong><br /><button onClick={() => socket.emit('press_uno', { code, pressedBy: playerId })}>Aperte UNO para penalizar</button></div>
          )}
        </div>
      )}

      {state && (
        <>
          <div><strong>Vez:</strong> {state.players[state.current].name}</div>
              <div style={{ marginTop: 12 }}>
                <h3>Pilha de descarte</h3>
                <div style={{ marginBottom: 8 }}>
                  {state.discard && (
                    <div style={{ display: 'inline-block', width: 60 }}>
                      <Card card={state.discard[state.discard.length - 1]} style={{ width: 60, height: 84 }} />
                    </div>
                  )}
                </div>
                <h3>Sua mão</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {state.players.find(p=>p.id===playerId)?.hand.map((c, i) => {
                    const playable = isCardPlayable(c);
                    const myIdx = state.players.findIndex(p => p.id === playerId);
                    const isMyTurn = myIdx === state.current;
                    const highlight = isMyTurn && playable;
                    const dim = isMyTurn ? !playable : false;
                    return (
                      <div key={i} onClick={() => handleCardClick(c)} style={{ cursor: playable && isMyTurn ? 'pointer' : 'default' }}>
                        <Card card={c} style={{ width:72, height:100, borderRadius:8, boxShadow: highlight ? '0 0 8px rgba(0,150,255,0.8)' : '0 2px 4px rgba(0,0,0,0.1)', opacity: dim ? 0.5 : 1 }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {/* controlar visibilidade dos botões conforme vez e pendingDraw */}
                {(() => {
                  const myIdx = state.players.findIndex(p => p.id === playerId);
                  const isMyTurn = myIdx === state.current;
                  const pending = state.pendingDraw || { type: null, amount: 0 };
                  if (!isMyTurn) {
                    return <div><button disabled>Não é sua vez</button></div>;
                  }
                  if (pending.amount > 0) {
                    // highlight the accept-penalty button if no playable cards
                    const myHand = state.players.find(p => p.id === playerId)?.hand || [];
                    const hasPlayable = myHand.some(isCardPlayable);
                    return (
                      <div>
                        <button disabled style={{ opacity: 0.6 }}>Comprar carta</button>
                        <div style={{ display: 'inline-block', position: 'relative' }}>
                          <button style={{ marginLeft: 8, boxShadow: !hasPlayable ? '0 0 12px rgba(255,0,0,0.9)' : undefined }} onClick={resolvePendingDraw}>Aceitar penalidade ({pending.amount})</button>
                          {!hasPlayable && (
                            <div style={{ position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap', marginTop: 6 }}>
                              Nenhuma carta jogável — aceite penalidade ou aguarde
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  const myHand = state.players.find(p => p.id === playerId)?.hand || [];
                  const hasPlayable = myHand.some(isCardPlayable);
                  return (
                    <div>
                      <div style={{ display: 'inline-block', position: 'relative' }}>
                        <button onClick={draw} style={{ boxShadow: !hasPlayable ? '0 0 12px rgba(0,150,255,0.9)' : undefined }}>Comprar carta</button>
                        {!hasPlayable && (
                          <div style={{ position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap', marginTop: 6 }}>
                            Nenhuma carta jogável — clique em Comprar para pegar uma carta
                          </div>
                        )}
                      </div>
                      <button style={{ marginLeft: 8 }} onClick={resolvePendingDraw}>Resolver penalidade (se houver)</button>
                    </div>
                  );
                })()}
              </div>

              {/* color picker modal */}
              {showColorPicker && selectedCard && (
                <div style={{ position: 'fixed', left: 0, top: 0, right:0, bottom:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)' }}>
                  <div style={{ background:'#fff', padding: 16, borderRadius: 8, textAlign:'center' }}>
                    <div style={{ marginBottom: 8 }}>Escolha a cor para a carta <strong>{selectedCard.type}</strong></div>
                    <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                      <button onClick={() => playWithColor(selectedCard, 'red')} style={{ background:'#d9534f', color:'#fff', padding:'8px 12px' }}>Vermelho</button>
                      <button onClick={() => playWithColor(selectedCard, 'green')} style={{ background:'#5cb85c', color:'#fff', padding:'8px 12px' }}>Verde</button>
                      <button onClick={() => playWithColor(selectedCard, 'blue')} style={{ background:'#0275d8', color:'#fff', padding:'8px 12px' }}>Azul</button>
                      <button onClick={() => playWithColor(selectedCard, 'yellow')} style={{ background:'#f0ad4e', color:'#fff', padding:'8px 12px' }}>Amarelo</button>
                    </div>
                    <div style={{ marginTop: 12 }}><button onClick={() => { setShowColorPicker(false); setSelectedCard(null); }}>Cancelar</button></div>
                  </div>
                </div>
              )}
        </>
      )}

      {/* victory modal (rendered even when state is null) */}
      {showWinnerModal && (
        <div style={{ position:'fixed', left:0, top:0, right:0, bottom:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)' }}>
          <div style={{ background:'#fff', padding:20, borderRadius:8, minWidth:300, textAlign:'center' }}>
            <h2>Vitória!</h2>
            <p>Jogador vencedor: <strong>{winnerId}</strong></p>
            <div style={{ marginTop:12 }}>
              <button onClick={() => { setShowWinnerModal(false); setWinnerId(null); }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
