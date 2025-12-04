import styled from 'styled-components'

export const Container = styled.main`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%);
  color: #ffffff;
  -webkit-font-smoothing: antialiased;
`

export const Hero = styled.header`
  text-align: center;
  margin-bottom: 28px;
`

export const Title = styled.h1`
  margin: 0;
  font-size: 2rem;
  letter-spacing: 0.4px;
  background: linear-gradient(90deg, #ff7a7a 0%, #ffd36b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: #0b1220;
`

export const Tag = styled.p`
  margin-top: 8px;
  color: rgba(11, 18, 34, 0.85);
  font-size: 0.95rem;
`

export const Actions = styled.section`
  display: flex;
  gap: 12px;
  flex-direction: column;
  width: 100%;
  max-width: 420px;

  @media (min-width: 640px) {
    flex-direction: row;
  }
`

export const BaseButton = styled.button`
  padding: 14px 18px;
  font-size: 1.05rem;
  border-radius: 12px;
  border: 0;
  cursor: pointer;
  width: 100%;
  box-shadow: 0 8px 20px rgba(2, 6, 23, 0.55);
  transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;

  &:active {
    transform: translateY(1px);
  }
`

export const HostButton = styled(BaseButton)`
  background: linear-gradient(90deg, #a7f3d0 0%, #67e8f9 100%);
  color: #04202a;
  font-weight: 700;
`

export const PlayerButton = styled(BaseButton)`
  background: #f1f5f9;
  color: #0b1220;
  border: 1px solid rgba(255, 255, 255, 0.08);
`
