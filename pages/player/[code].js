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
      s.on('uno_resolved', (info) => { setUnoAlert(null); alert(info.penalty ? `UNO! ${info.ownerId} penalizado`: `${info.ownerId} fez UNO`); });
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

      {state && (
        <>
          {unoAlert && (
            <div style={{ marginTop: 8 }}>
              {unoAlert.ownerId === playerId ? (
                <div><strong>Você tem apenas 1 carta! Pressione UNO para marcar.</strong><br /><button onClick={() => socket.emit('press_uno', { code, pressedBy: playerId })}>UNO</button></div>
              ) : (
                <div><strong>{unoAlert.ownerId} está com 1 carta!</strong><br /><button onClick={() => socket.emit('press_uno', { code, pressedBy: playerId })}>Aperte UNO para penalizar</button></div>
              )}
            </div>
          )}
          <div><strong>Vez:</strong> {state.players[state.current].name}</div>
              <div style={{ marginTop: 12 }}>
                <h3>Sua mão</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {state.players.find(p=>p.id===playerId)?.hand.map((c, i) => (
                    <div key={i} style={{ cursor: 'pointer' }} onClick={() => play(c)}>
                      <div style={{ width:72, height:100, borderRadius:8, background: c.color || '#333', color:'#fff', display:'flex',alignItems:'center',justifyContent:'center' }}>{c.type==='number'?c.value:c.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <button onClick={draw}>Comprar carta</button>
                <button style={{ marginLeft: 8 }} onClick={resolvePendingDraw}>Resolver penalidade (se houver)</button>
              </div>
        </>
      )}
    </div>
  );
}
