export default function handler(req, res) {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'missing code' });
  const games = global.unoGames;
  if (!games) return res.status(500).json({ error: 'logs not available' });
  const room = games.get(code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  return res.status(200).json({ logs: room.logs || [] });
}
