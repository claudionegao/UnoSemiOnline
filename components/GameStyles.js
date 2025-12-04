import styled from 'styled-components'

export const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 40px);
  margin: 20px;
`

export const InnerContainer = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background-color: white;
  display: flex;
  justify-content: center;
  align-items: center;
`

export const GameArea = styled.div`
  width: 100%;
  max-width: 980px;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
`

export const Section = styled.div`
  margin-bottom: 12px;
  width: 100%;
`

export const HandList = styled.div`
  display: flex;
  gap: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 4px;
  justify-content: center;
  width: 100%;
  align-items: center;
  height: 190px;
  /* centraliza e permite a sobreposição por margens negativas */
`

export const CardItem = styled.div`
  position: relative;
  display: inline-block;
  transition: transform 140ms ease, box-shadow 140ms ease;
  ${props => (props.$playable ? 'transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.18);' : 'transform: translateY(0);')}
`

export const CardImage = styled.img`
  width: 120px;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 6px 12px rgba(0,0,0,0.12);
  display: block;
  transition: filter 140ms ease, transform 140ms ease;
  ${props => (props.$dim ? 'filter: brightness(0.5);' : '')}
`

export const PlayersList = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  align-items: center;
  justify-content: space-evenly;
  overflow-x: auto;
  width: 100%;
  padding: 6px 0;
`

export const PlayerItem = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 8px 12px;
  min-width: 30px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #f0f0f0;
  font-size: 13px;
`

export const PlayerName = styled.div`
  color: #222;
`

export const CardCount = styled.div`
  background: #eee;
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 12px;
  color: #333;
`

export const Footer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 8px;
  width: 100%;
`

export const UnoButton = styled.button`
  padding: 8px 20px;
  border-radius: 20px;
  border: 0;
  background: #ff5b5b;
  color: white;
  font-weight: 700;
  cursor: pointer;
  font-size: 14px;
`

export const FloatingMenu = styled.div`
  position: fixed;
  right: 24px;
  bottom: 24px;
  display: flex;
  gap: 8px;
  align-items: center;
  background: rgba(255,255,255,0.95);
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  z-index: 1200;
`

export const MenuButton = styled.button`
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  background: #fff;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  min-width: 64px;
`

export const PilePreview = styled.div`
  position: fixed;
  top: 16px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255,255,255,0.98);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.14);
  transition: transform 300ms cubic-bezier(.22,1,.36,1), opacity 220ms ease;
  transform-origin: top right;
  transform: ${props => (props.visible ? 'translate(0, 0)' : 'translate(48px, -48px)')};
  opacity: ${props => (props.visible ? 1 : 0)};
  z-index: 2000;
  pointer-events: none;
`

export const PileCard = styled.div`
  width: 96px;
  height: auto;
`

export const CardImageSmall = styled.img`
  width: 96px;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 6px 12px rgba(0,0,0,0.12);
  display: block;
`

export const WildModalOverlay = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  z-index: 4000;
`

export const WildModalContent = styled.div`
  background: #fff;
  padding: 18px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
`

export const WildCircle = styled.div`
  width: 220px;
  height: 220px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
`

export const WildSector = styled.button`
  width: 50%;
  height: 50%;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: pointer;
  outline: none;
`

export const VictoryOverlay = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 3000;
`

export const VictoryText = styled.div`
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 18px 28px;
  border-radius: 8px;
  font-size: 20px;
  font-weight: 700;
`
