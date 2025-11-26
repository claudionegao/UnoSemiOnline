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
      const s = io(undefined, { path: '/api/socket' });
      socketRef.current = s;
      setIo(s);

      s.on('created', ({ code }) => setRoom(code));
      s.on('player_joined', ({ players }) => setPlayers(players));
      s.on('state_update', (st) => setState(st));
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
    io.emit('create_room', (res) => {});
  }

  function startGame() {
    const ids = players.length ? players : ['P1', 'P2'];
    io.emit('start_game', { code: room, playerIds: ids });
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Mesa - UNO</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={createRoom}>Criar sala</button>
        {room && <span style={{ marginLeft: 12 }}>Sala: {room}</span>}
      </div>
      <div style={{ marginBottom: 12 }}>
        <button onClick={startGame}>Iniciar jogo</button>
      </div>

      {/* QR shortcut to player page (Google Charts) */}
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
      <ul>
        {players.map((p, i) => (
          <li key={i}>{i + 1}. {p}</li>
        ))}
      </ul>

      <h3>Pilha de descarte</h3>
      <div>
        {state && state.discard && <Card card={state.discard[state.discard.length-1]} />}
      </div>

      {unoAlert && (
        <div style={{ marginTop: 12, padding: 8, background: '#ffd', border: '1px solid #ccc' }}>
          <strong>{unoAlert.ownerId} está em UNO!</strong>
        </div>
      )}

      <h3>Contagem de cartas</h3>
      <ul>
        {state && state.players && state.players.map(p => (
          <li key={p.id}>{p.name}: {p.hand.length} cartas</li>
        ))}
      </ul>

      <div style={{ marginTop: 20 }}>
        <strong>Vez:</strong> {state && state.players ? state.players[state.current].name : '—'}
      </div>

      {/* victory modal */}
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
