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

  // map card to filename convention used in assets: number_color.png, type_color.png, wild.png, wild_draw4.png
  const filename = card
    ? (card.type === 'number' ? `${card.value}_${card.color}` : (card.type === 'wild' || card.type === 'wild_draw4' ? `${card.type}` : `${card.type}_${card.color}`))
    : 'back';

  const src = `/assets/cards/${filename}.png`;

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
