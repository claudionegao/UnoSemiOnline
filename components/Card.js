import styled from 'styled-components';
import { useState } from 'react';

const CardBox = styled.div`
  width: 72px;
  height: 100px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  overflow: hidden;
`;

export default function Card({ card, style, className }) {
  const [imgError, setImgError] = useState(false);

  let bg = '#333';
  if (!card) bg = '#555';
  else if (card.color === 'red') bg = '#d9534f';
  else if (card.color === 'green') bg = '#5cb85c';
  else if (card.color === 'blue') bg = '#0275d8';
  else if (card.color === 'yellow') bg = '#f0ad4e';
  else bg = '#222';

  const textColor = (card && card.color === 'yellow') ? '#222' : '#fff';

  const label = card ? (card.type === 'number' ? `${card.value} ${card.color || ''}` : `${card.type} ${card.color || ''}`) : '';

  // map card to filename convention present in `public/assets/cards`:
  // - Numbers: Color_Value => e.g. 'Blue_5.png'
  // - Actions: Color_Draw, Color_Reverse, Color_Skip => e.g. 'Red_Draw.png'
  // - Wilds: 'Wild.png' and 'Wild_Draw.png'
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  let filename;
  if (!card) {
    filename = null; // no image, fallback to colored box
  } else if (card.type === 'number') {
    filename = `${cap(card.color)}_${card.value}`;
  } else if (card.type === 'draw2') {
    filename = `${cap(card.color)}_Draw`;
  } else if (card.type === 'reverse') {
    filename = `${cap(card.color)}_Reverse`;
  } else if (card.type === 'skip') {
    filename = `${cap(card.color)}_Skip`;
  } else if (card.type === 'wild') {
    filename = `Wild`;
  } else if (card.type === 'wild_draw4') {
    filename = `Wild_Draw`;
  } else {
    // generic fallback using type and color
    filename = card.color ? `${cap(card.color)}_${cap(card.type)}` : `${cap(card.type)}`;
  }

  const src = filename ? `/assets/cards/${filename}.png` : null;

  return (
    <CardBox title={label} className={className} style={{ background: !imgError ? undefined : bg, color: textColor, ...style }}>
      {!imgError && (
        // image will fill the card; on error we fall back to colored background
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label || 'card'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => { setImgError(true); e.currentTarget.style.display = 'none'; }}
        />
      )}
      {imgError && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card && card.type === 'number' ? card.value : card && card.type ? card.type.toUpperCase() : ''}</div>
      )}
    </CardBox>
  );
}
