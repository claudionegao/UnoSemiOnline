import React, { useState } from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const Modal = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  min-width: 280px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Title = styled.h2`
  margin: 0 0 8px 0;
  color: #667eea;
  font-size: 22px;
  text-align: center;
  font-weight: 800;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  font-size: 15px;
  border: 2px solid #e0e7ff;
  border-radius: 10px;
  box-sizing: border-box;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  background: #f8faff;

  &:focus {
    border-color: #667eea;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15);
  }

  &::placeholder {
    color: #a5b4fc;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 700;
  background: ${props => props.disabled ? '#e0e7ff' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  color: ${props => props.disabled ? '#a5b4fc' : '#fff'};
  border: none;
  border-radius: 10px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 10px;
  box-shadow: ${props => props.disabled ? 'none' : '0 8px 20px rgba(102, 126, 234, 0.35)'};
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &:active:not(:disabled) {
    transform: scale(0.97);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
  }
`;

export default function ModalName({ open, onClose, onSubmit, title }) {
  const [nome, setNome] = useState('');

  if (!open) return null;

  return (
    <Overlay>
      <Modal>
        <Title>{title || 'Informe seu nome'}</Title>
        <Input
          type="text"
          placeholder="Seu nome"
          value={nome}
          onChange={e => setNome(e.target.value)}
        />
        <Button
          disabled={!nome}
          onClick={() => {
            if (nome) {
              onSubmit(nome);
              setNome('');
            }
          }}
        >Confirmar</Button>
        <Button style={{background:'#e0e7ff',color:'#667eea',marginTop:0}} onClick={onClose}>Cancelar</Button>
      </Modal>
    </Overlay>
  );
}
