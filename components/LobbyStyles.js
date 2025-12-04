import styled from 'styled-components'

export const Container = styled.main`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%);
  color: #0b1220;
`

export const MainCard = styled.section`
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 12px 30px rgba(9, 30, 66, 0.06);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
`

export const RoomRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`

export const RoomLabel = styled.div`
  font-size: 0.9rem;
  color: rgba(11, 18, 34, 0.6);
`

export const RoomCode = styled.div`
  font-weight: 800;
  letter-spacing: 1.5px;
  background: linear-gradient(90deg, #67e8f9 0%, #a7f3d0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(6, 6, 6, 0.04);
  font-size: 1.05rem;
`

export const Players = styled.div``

export const PlayersTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #0b1220;
`

export const PlayerList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-right: 6px;

  @media (min-width: 640px) {
    max-height: 150px;
  }
`

export const PlayerItem = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: ${(p) => (p.$ready ? '#f0fdf4' : '#fff')};
  border: 1px solid ${(p) => (p.$ready ? '#dcfce7' : '#eef2ff')};
  border-radius: 10px;
  font-size: 0.97rem;
`

export const PlayerName = styled.span`
  font-weight: 600;
  color: #072030;
`

export const PlayerReady = styled.span`
  font-size: 0.85rem;
  color: rgba(11, 18, 34, 0.6);
`

export const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(2,6,23,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
`

export const ModalCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 18px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 12px 30px rgba(9,30,66,0.12);
`

export const ModalTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 1.05rem;
`

export const ModalInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e6eef8;
  margin-bottom: 12px;
  font-size: 1rem;
`

export const ModalActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

export const QRWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 10px;
  background: #fafbff;
  border: 1px dashed #e6eef8;
  width: 100%;
  box-sizing: border-box;
`

export const QRImage = styled.img`
  width: 200px;
  height: 200px;
  object-fit: contain;
  border-radius: 8px;
`

export const QRHint = styled.span`
  font-size: 0.86rem;
  color: rgba(11,18,34,0.65);
`

export const TopRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
`

export const QRWrapperSmall = styled(QRWrapper)`
  width: 96px;
  padding: 6px;
  background: #fff;
  border-radius: 8px;
  border: 1px dashed #eef2ff;
  align-items: center;
`

export const QRImageSmall = styled(QRImage)`
  width: 95px;
  height: 95px;
`

export const QRHintSmall = styled(QRHint)`
  font-size: 0.72rem;
  text-align: center;
`

export const InfoColumn = styled.div`
  flex: 1 1 0;
  min-width: 0;
`

export const Actions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: stretch;
  flex-direction: column;
  width: 100%;

  @media (min-width: 640px) {
    flex-direction: row;
    justify-content: flex-end;
    width: auto;
  }
`

export const BaseBtn = styled.button`
  padding: 14px 16px;
  border-radius: 12px;
  border: 0;
  cursor: pointer;
  font-weight: 700;
  width: 100%;
  font-size: 1rem;
`

export const PrimaryBtn = styled(BaseBtn)`
  background: linear-gradient(90deg, #06b6d4 0%, #22c55e 100%);
  color: #041022;
`

export const SecondaryBtn = styled(BaseBtn)`
  background: #fff;
  color: #0b1220;
  border: 1px solid #e6eef8;

  @media (min-width: 640px) {
    width: auto;
    padding: 10px 14px;
  }
`
