import styled from 'styled-components';

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
`;

export default function Card({ card }) {
  let bg = '#333';
  if (!card) bg = '#555';
  else if (card.color === 'red') bg = '#d9534f';
  else if (card.color === 'green') bg = '#5cb85c';
  else if (card.color === 'blue') bg = '#0275d8';
  else if (card.color === 'yellow') bg = '#f0ad4e';
  else bg = '#222';

  // choose readable text color depending on background
  const textColor = (card && card.color === 'yellow') ? '#222' : '#fff';

  const label = card ? (card.type === 'number' ? `${card.value} ${card.color || ''}` : `${card.type} ${card.color || ''}`) : '';
  return (
    <CardBox title={label} style={{ background: bg, color: textColor }}>
      {card && card.type === 'number' ? card.value : card && card.type ? card.type.toUpperCase() : ''}
    </CardBox>
  );
}
