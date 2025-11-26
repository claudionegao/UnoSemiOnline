import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Card from '../components/Card';

export default function TableView() {
  const [io, setIo] = useState(null);
  const socketRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [state, setState] = useState(null);
  const [unoAlert, setUnoAlert] = useState(null);

  useEffect(() => {
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
      s.on('uno_resolved', (info) => { setUnoAlert(null); alert(info.penalty ? `${info.ownerId} penalizado por UNO` : `${info.ownerId} fez UNO`); });
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

      <h3>Jogadores</h3>
      <ul>
        {players.map((p, i) => (
          <li key={i}>{p}</li>
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
    </div>
  );
}
