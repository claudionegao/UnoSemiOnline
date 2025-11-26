import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Join() {
  const router = useRouter();
  const [code, setCode] = useState('');

  function isMobile() {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  useEffect(() => {
    // if code param present and on mobile, auto-redirect
    const { code: q } = router.query;
    if (q && typeof q === 'string' && isMobile()) {
      router.replace(`/player/${q}`);
    }
  }, [router.query]);

  function submit(e) {
    e && e.preventDefault();
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return;
    // always navigate to player view; on mobile this is the intended path
    router.push(`/player/${normalized}`);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Entrar em sala</h1>
      <form onSubmit={submit}>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código da sala" style={{ padding: 8, fontSize: 16, textTransform: 'uppercase' }} />
        <button style={{ marginLeft: 8 }} onClick={submit}>Entrar</button>
      </form>
      <p style={{ marginTop: 12 }}>Se você estiver em um dispositivo móvel e acessar esta página com `?code=XXXXX` na URL, você será redirecionado automaticamente para a tela do jogador.</p>
    </div>
  );
}
