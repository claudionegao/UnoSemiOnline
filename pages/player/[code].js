import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';

export default function PlayerView() {
  const router = useRouter();
  const { code } = router.query;
  const [socket, setSocket] = useState(null);
  const [state, setState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [name, setName] = useState('');
  const [unoAlert, setUnoAlert] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerId, setWinnerId] = useState(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (!code) return;
    let s;
    import('socket.io-client').then(({ io }) => {
      s = io(undefined, { path: '/api/socket' });
      setSocket(s);
      s.on('state_update', st => setState(st));
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

  function join() {
    const id = name || `P-${Math.floor(Math.random()*1000)}`;
    setPlayerId(id);
    socket.emit('join_room', { code, playerId: id, name: id }, (res) => {
      // after join ask for state
      socket.emit('get_state', { code }, (r) => { if (r.state) setState(r.state); });
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
    socket.emit('draw_card', { code, playerId, count: 1 }, (res) => {});
  }

  // função pra resolver penalidade (quando existe pendingDraw): chama draw_card sem count
  function resolvePendingDraw() {
    if (!socket) return;
    socket.emit('draw_card', { code, playerId, count: 0 }, (res) => {});
  }

  return (
    <div style={{ padding: 16 }}>
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
                <h3>Sua mão</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {state.players.find(p=>p.id===playerId)?.hand.map((c, i) => {
                        const playable = isCardPlayable(c);
                        const myIdx = state.players.findIndex(p => p.id === playerId);
                        const isMyTurn = myIdx === state.current;
                        const highlight = isMyTurn && playable;
                        const dim = !playable;

                        // map color names to nicer backgrounds and pick readable text color
                        let bg = '#333';
                        if (c.color === 'red') bg = '#d9534f';
                        else if (c.color === 'green') bg = '#5cb85c';
                        else if (c.color === 'blue') bg = '#0275d8';
                        else if (c.color === 'yellow') bg = '#f0ad4e';

                        const textColor = c.color === 'yellow' ? '#222' : '#fff';

                        return (
                          <div key={i} style={{ cursor: playable && isMyTurn ? 'pointer' : 'default' }} onClick={() => handleCardClick(c)}>
                            <div style={{ width:72, height:100, borderRadius:8, background: bg, color: textColor, display:'flex',alignItems:'center',justifyContent:'center', boxShadow: highlight ? '0 0 12px rgba(255,255,0,0.9)' : '0 2px 6px rgba(0,0,0,0.2)', transform: highlight ? 'translateY(-4px)' : 'none', transition: 'all 120ms ease', opacity: dim ? 0.35 : 1, filter: dim ? 'brightness(0.5) contrast(0.9)' : 'none' }}>{c.type==='number'?c.value:c.type}</div>
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
