import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Card from '../components/Card';

export default function TableView() {
  const [io, setIo] = useState(null);
  const socketRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [state, setState] = useState(null);
  const [unoAlert, setUnoAlert] = useState(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerId, setWinnerId] = useState(null);
  const [mode, setMode] = useState('landing'); // 'landing' | 'table' | 'solo'
  const [hostPlayerId, setHostPlayerId] = useState(null);
  const [isHostPlayer, setIsHostPlayer] = useState(false);
  const [hostName, setHostName] = useState('');
  const [soloSetup, setSoloSetup] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const hostLastAutoRef = useRef(null);
  const hostLastSeenCurrentRef = useRef(null);
  const hostLatestStateRef = useRef(null);

  useEffect(() => {
    // redirect mobile users to /join to enter room code
    const routerRedirect = () => {
      try {
        if (typeof navigator === 'undefined') return false;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) router.replace('/join');
      } catch (e) {}
    };

    routerRedirect();

    let mounted = true;
    import('socket.io-client').then(({ io }) => {
      if (!mounted) return;
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
      const s = io(socketUrl, { path: socketUrl ? undefined : '/api/socket' });
      socketRef.current = s;
      setIo(s);

      s.on('created', ({ code }) => setRoom(code));
      s.on('player_joined', ({ players }) => setPlayers(players));
      s.on('player_disconnected', ({ playerId }) => {
        // if in lobby, remove from players list; if game active, update state players connected flag
        setPlayers(prev => prev.filter(p => p !== playerId));
        setState(prev => {
          if (!prev || !prev.players) return prev;
          const next = { ...prev, players: prev.players.map(p => p.id === playerId ? { ...p, connected: false } : p) };
          return next;
        });
      });
      s.on('state_update', (st) => { hostLatestStateRef.current = st; setState(st); });
      s.on('uno_alert', ({ ownerId }) => setUnoAlert({ ownerId }));
      s.on('uno_resolved', (info) => { setUnoAlert(null); /* removed alert box for UNO */ });
      s.on('game_over', ({ winnerId }) => {
        // show winner modal and reset table state to waiting
        setWinnerId(winnerId);
        setShowWinnerModal(true);
        setState(null);
      });
    });
    return () => { mounted = false; if (socketRef.current) socketRef.current.close(); };
  }, []);

  function createRoom() {
    if (!io) {
      alert('Socket não conectado ainda. Aguarde alguns segundos e tente novamente.');
      return;
    }
    io.emit('create_room', (res) => {
      if (res && res.code) {
        setRoom(res.code);
        setMode('table');
      }
    });
  }

  function startGame() {
    if (!io) {
      alert('Socket não conectado ainda. Aguarde alguns segundos e tente novamente.');
      return;
    }
    const ids = players.length ? players : ['P1', 'P2'];
    io.emit('start_game', { code: room, playerIds: ids });
  }

  function createAndJoinAsHost() {
    // show setup UI to ask for host name before creating room
    setHostName('');
    setSoloSetup(true);
    setMode('landing');
  }

  function startSoloGame() {
    if (!io) return alert('Socket não conectado ainda.');
    const name = (hostName || '').trim();
    if (!name) return alert('Informe o nome do jogador');

    // create room -> join as player -> start game
    io.emit('create_room', (res) => {
      if (!res || !res.code) return alert('falha ao criar sala');
      const code = res.code;
      setRoom(code);
      io.emit('join_room', { code, playerId: name, name }, (r) => {
        setHostPlayerId(name);
        setIsHostPlayer(true);
        // join succeeded; wait for host to press "Iniciar jogo"
        setMode('solo');
        setSoloSetup(false);
      });
    });
  }

  function playAsHost(card) {
    if (!io || !hostPlayerId || !room) return;
    io.emit('play_card', { code: room, playerId: hostPlayerId, card }, (res) => { if (res && res.error) alert(res.error); });
  }

  function playAsHostWithColor(card, color) {
    if (!io || !hostPlayerId || !room) return;
    io.emit('play_card', { code: room, playerId: hostPlayerId, card, chosenColor: color }, (res) => { if (res && res.error) alert(res.error); });
    setShowColorPicker(false);
    setSelectedCard(null);
  }

  function isCardPlayable(card) {
    if (!state) return false;
    const top = state.discard && state.discard[state.discard.length - 1];
    const pending = state.pendingDraw || { type: null, amount: 0 };
    if (pending.amount > 0) return card.type === pending.type;
    if (card.type === 'wild' || card.type === 'wild_draw4') return true;
    if (!top) return true;
    if (card.color && top.color && card.color === top.color) return true;
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
    if (card.type === top.type && card.type !== 'number') return true;
    return false;
  }

  function drawAsHost(count = 1) {
    if (!io || !hostPlayerId || !room) return;
    console.log('[drawAsHost] emitting draw_card', { room, hostPlayerId, count });
    try { io.emit('client_log', { code: room, level: 'info', msg: '[drawAsHost] request draw', meta: { playerId: hostPlayerId, count } }); } catch(e){}
    io.emit('draw_card', { code: room, playerId: hostPlayerId, count }, (res) => {
      console.log('[drawAsHost] res', res);
      try { io.emit('client_log', { code: room, level: 'info', msg: '[drawAsHost] response', meta: { res } }); } catch(e){}
      // request fresh state after draw, with retries
      try {
        const prior = (hostLatestStateRef.current && hostLatestStateRef.current.current) || (state && state.current);
        fetchStateWithRetries(prior).then(() => {});
      } catch(e){}
    });
  }

  function resolvePendingDrawHost() {
    if (!io || !hostPlayerId || !room) return;
    console.log('[resolvePendingDrawHost] emitting draw_card count=0', { room, hostPlayerId });
    try { io.emit('client_log', { code: room, level: 'info', msg: '[resolvePendingDrawHost] request draw 0', meta: { playerId: hostPlayerId } }); } catch(e){}
    io.emit('draw_card', { code: room, playerId: hostPlayerId, count: 0 }, (res) => {
      console.log('[resolvePendingDrawHost] res', res);
      try { io.emit('client_log', { code: room, level: 'info', msg: '[resolvePendingDrawHost] response', meta: { res } }); } catch(e){}
      // request fresh state after resolving penalty, with retries
      try {
        const prior2 = (hostLatestStateRef.current && hostLatestStateRef.current.current) || (state && state.current);
        fetchStateWithRetries(prior2).then(() => {});
      } catch(e){}
    });
  }

  // helper: fetch latest state with limited retries when prior current index did not advance
  function fetchStateWithRetries(priorCurrent, maxRetries = 2, delay = 700) {
    return new Promise((resolve) => {
      let attempts = 0;
      const tryFetch = () => {
        io.emit('get_state', { code: room }, (r) => {
          if (r && r.state) { hostLatestStateRef.current = r.state; setState(r.state); }
          const newC = r && r.state ? r.state.current : (hostLatestStateRef.current && hostLatestStateRef.current.current);
          if (typeof priorCurrent === 'undefined' || newC !== priorCurrent) return resolve(r && r.state ? r.state : hostLatestStateRef.current);
          attempts++;
          if (attempts > maxRetries) return resolve(r && r.state ? r.state : hostLatestStateRef.current);
          setTimeout(tryFetch, delay);
        });
      };
      tryFetch();
    });
  }

  // Auto-action for host when this device is also a player (solo mode)
  useEffect(() => {
    if (!state || !hostPlayerId || !io) return;
    const freshState = hostLatestStateRef.current || state;
    const myIdx = (freshState.players || []).findIndex(p => p.id === hostPlayerId);
    if (myIdx === -1) return;
    if (myIdx !== freshState.current) return; // not your turn

    const pending = freshState.pendingDraw || { type: null, amount: 0 };
    const myHand = (freshState.players && freshState.players[myIdx] && freshState.players[myIdx].hand) || [];
    const isCardPlayableLocal = (card) => {
      if (!state) return false;
      const top = state.discard && state.discard[state.discard.length - 1];
      if (pending.amount > 0) return card.type === pending.type;
      if (card.type === 'wild' || card.type === 'wild_draw4') return true;
      if (!top) return true;
      if (card.color && top.color && card.color === top.color) return true;
      if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
      if (card.type === top.type && card.type !== 'number') return true;
      return false;
    };
    const hasPlayable = myHand.some(isCardPlayableLocal);

    // reset markers
    if (hostLastSeenCurrentRef.current !== freshState.current) {
      hostLastAutoRef.current = null;
      hostLastSeenCurrentRef.current = freshState.current;
    }
    if (hostLastAutoRef.current === freshState.current) return;

    if (!hasPlayable) {
      // small delay
      const t = setTimeout(() => {
        const fresh = hostLatestStateRef.current || state;
        const curIdx = (fresh.players || []).findIndex(p => p.id === hostPlayerId);
        if (curIdx !== fresh.current) return;
        hostLastAutoRef.current = fresh.current;
        const actionMsg = pending.amount > 0 ? `accept ${pending.amount}` : 'draw 1';
        try { io.emit('client_log', { code: room, level: 'info', msg: `[host-auto-action] ${actionMsg}`, meta: { playerId: hostPlayerId, turn: fresh.current } }); } catch(e){}
        console.log('[host-auto-action] performing', { actionMsg, hostPlayerId, turn: fresh.current, pending });
        if (pending.amount > 0) {
          resolvePendingDrawHost();
        } else {
          drawAsHost(1);
        }
      }, 900);
      return () => clearTimeout(t);
    }
  }, [state, hostPlayerId, io]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {mode === 'landing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
          <h1>Mesa - UNO</h1>
          <div style={{ display: 'flex', gap: 20 }}>
            <button onClick={createRoom} style={{ padding: '24px 40px', fontSize: 20, borderRadius: 12 }}>Criar Mesa</button>
            <button onClick={createAndJoinAsHost} style={{ padding: '24px 40px', fontSize: 20, borderRadius: 12 }}>Jogar Sem Mesa</button>
          </div>
          <p style={{ marginTop: 12 }}>Escolha criar uma mesa para disponibilizar QR para jogadores, ou jogar sem mesa e usar este dispositivo como jogador.</p>
          {soloSetup && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input placeholder="Seu nome" value={hostName} onChange={e => setHostName(e.target.value)} style={{ padding: 8, fontSize: 16 }} />
              <button onClick={startSoloGame} style={{ padding: '12px 16px' }}>Iniciar jogo</button>
              <button onClick={() => { setSoloSetup(false); setHostName(''); }}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      {(mode === 'table' || mode === 'solo') && (
        <div style={{ width: '100%', maxWidth: 980 }}>
          <div style={{ marginBottom: 12 }}>
            {mode === 'table' && <button onClick={createRoom}>Criar sala</button>}
            {room && <span style={{ marginLeft: 12 }}>Sala: {room}</span>}
            {(mode === 'table' || (mode === 'solo' && isHostPlayer)) && !state && <button style={{ marginLeft: 12 }} onClick={startGame}>Iniciar jogo</button>}
          </div>

          {/* QR */}
          {room && typeof window !== 'undefined' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 6 }}>Atalho QR para jogadores:</div>
              <img
                alt={`QR /player/${room}`}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/player/' + room)}`}
                style={{ width: 150, height: 150, border: '1px solid #ccc' }}
              />
            </div>
          )}

          <h3>Jogadores</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {state && state.players ? state.players.map((p, i) => (
              <div key={p.id} style={{ width: 160, minHeight: 64, borderRadius: 8, padding: 8, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, background: p.connected === false ? '#ddd' : '#0275d8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{p.name ? p.name.charAt(0).toUpperCase() : '?'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}{p.connected === false ? ' • desconectado' : ''}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{p.hand.length} cartas</div>
                </div>
                <div style={{ fontSize: 12, background: '#f7f7f7', padding: '6px 8px', borderRadius: 6 }}>{i + 1}</div>
              </div>
            )) : players.map((p, i) => (
              <div key={i} style={{ width: 160, minHeight: 64, borderRadius: 8, padding: 8, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, background: '#8c8c8c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{String(p).charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>aguardando</div>
                </div>
                <div style={{ fontSize: 12, background: '#f7f7f7', padding: '6px 8px', borderRadius: 6 }}>{i + 1}</div>
              </div>
            ))}
          </div>

          {/* when game exists, keep only discard, players list and host player's hand (if host is player) */}
          {state && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <h4 style={{ margin: 0 }}>Pilha</h4>
                  <div style={{ marginTop: 6, width: 64 }}>
                    {state.discard && <Card card={state.discard[state.discard.length-1]} style={{ width: 64, height: 90, borderRadius: 6 }} />}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0 }}>Mesa</h4>
                  <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>{state.direction === 1 ? 'Horário' : 'Anti-horário'} • Jogador da vez: {state.players[state.current].name}</div>
                </div>
              </div>

              {isHostPlayer && hostPlayerId && (
                <div style={{ marginTop: 12 }}>
                  {unoAlert && (
                    <div style={{ marginTop: 8 }}>
                      {unoAlert.ownerId === hostPlayerId ? (
                        <div><strong>Você tem apenas 1 carta! Pressione UNO para marcar.</strong><br /><button onClick={() => io && io.emit('press_uno', { code: room, pressedBy: hostPlayerId })}>UNO</button></div>
                      ) : (
                        <div><strong>{unoAlert.ownerId} está com 1 carta!</strong><br /><button onClick={() => io && io.emit('press_uno', { code: room, pressedBy: hostPlayerId })}>Aperte UNO para penalizar</button></div>
                      )}
                    </div>
                  )}
                  <h3>Sua mão (host)</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {state.players.find(p=>p.id===hostPlayerId)?.hand.map((c, i) => {
                      const myIdx = state.players.findIndex(p => p.id === hostPlayerId);
                      const isMyTurn = myIdx === state.current;
                      const playable = isCardPlayable(c);
                      const highlight = isMyTurn && playable;
                      const dim = isMyTurn ? !playable : false;
                      const handleClick = () => {
                        if (!isMyTurn) return;
                        const pending = state.pendingDraw || { type: null, amount: 0 };
                        if (pending.amount > 0 && c.type !== pending.type) {
                          alert('Existe uma penalidade pendente: só é possível empilhar a mesma carta de compra ou aceitar a penalidade.');
                          return;
                        }
                        if (c.type === 'wild' || c.type === 'wild_draw4') {
                          setSelectedCard(c);
                          setShowColorPicker(true);
                          return;
                        }
                        playAsHost(c);
                      };

                      return (
                        <div key={i} onClick={handleClick} style={{ cursor: playable && isMyTurn ? 'pointer' : 'default' }}>
                          <Card card={c} style={{ width:72, height:100, borderRadius:8, boxShadow: highlight ? '0 0 8px rgba(0,150,255,0.8)' : '0 2px 4px rgba(0,0,0,0.1)', opacity: dim ? 0.5 : 1 }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {/* controlar visibilidade dos botões conforme vez e pendingDraw (host) */}
                    {(() => {
                      const myIdx = state.players.findIndex(p => p.id === hostPlayerId);
                      const isMyTurn = myIdx === state.current;
                      const pending = state.pendingDraw || { type: null, amount: 0 };
                      if (!isMyTurn) {
                        return <div><button disabled>Não é sua vez</button></div>;
                      }
                      if (pending.amount > 0) {
                        const myHand = state.players.find(p => p.id === hostPlayerId)?.hand || [];
                        const hasPlayable = myHand.some(isCardPlayable);
                        return (
                          <div>
                            <button disabled style={{ opacity: 0.6 }}>Comprar carta</button>
                            <div style={{ display: 'inline-block', position: 'relative' }}>
                              <button style={{ marginLeft: 8, boxShadow: !hasPlayable ? '0 0 12px rgba(255,0,0,0.9)' : undefined }} onClick={resolvePendingDrawHost}>Aceitar penalidade ({pending.amount})</button>
                              {!hasPlayable && (
                                <div style={{ position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap', marginTop: 6 }}>
                                  Nenhuma carta jogável — aceite penalidade ou aguarde
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      const myHand = state.players.find(p => p.id === hostPlayerId)?.hand || [];
                      const hasPlayable = myHand.some(isCardPlayable);
                      return (
                        <div>
                          <div style={{ display: 'inline-block', position: 'relative' }}>
                            <button onClick={() => drawAsHost(1)} style={{ boxShadow: !hasPlayable ? '0 0 12px rgba(0,150,255,0.9)' : undefined }}>Comprar carta</button>
                            {!hasPlayable && (
                              <div style={{ position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap', marginTop: 6 }}>
                                Nenhuma carta jogável — clique em Comprar para pegar uma carta
                              </div>
                            )}
                          </div>
                          <button style={{ marginLeft: 8 }} onClick={resolvePendingDrawHost}>Resolver penalidade (se houver)</button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
          {showColorPicker && selectedCard && (
            <div style={{ position: 'fixed', left:0, top:0, right:0, bottom:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)' }}>
              <div style={{ background:'#fff', padding: 16, borderRadius: 8, textAlign:'center' }}>
                <div style={{ marginBottom: 8 }}>Escolha a cor para a carta <strong>{selectedCard.type}</strong></div>
                <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                  <button onClick={() => playAsHostWithColor(selectedCard, 'red')} style={{ background:'#d9534f', color:'#fff', padding:'8px 12px' }}>Vermelho</button>
                  <button onClick={() => playAsHostWithColor(selectedCard, 'green')} style={{ background:'#5cb85c', color:'#fff', padding:'8px 12px' }}>Verde</button>
                  <button onClick={() => playAsHostWithColor(selectedCard, 'blue')} style={{ background:'#0275d8', color:'#fff', padding:'8px 12px' }}>Azul</button>
                  <button onClick={() => playAsHostWithColor(selectedCard, 'yellow')} style={{ background:'#f0ad4e', color:'#fff', padding:'8px 12px' }}>Amarelo</button>
                </div>
                <div style={{ marginTop: 12 }}><button onClick={() => { setShowColorPicker(false); setSelectedCard(null); }}>Cancelar</button></div>
              </div>
            </div>
          )}
            </div>
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
      )}
    </div>
  );
}
