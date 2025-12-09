import styled from 'styled-components';

export const Container = styled.div`
	width: 100vw;
	height: 100vh;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	background: azure;
	overflow: hidden;
`;

export const Card = styled.div`
	background: #fff;
	border-radius: 16px;
	box-shadow: 0 8px 32px rgba(0,0,0,0.18);
	padding: 24px;
	margin: 16px 0;
	width: 90vw;
	max-width: 400px;
`;

export const CardRight = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-end;
`;

export const Title = styled.h1`
	color: #667eea;
	font-size: 28px;
	font-weight: 800;
	margin: 0px 0 8px 0;
	text-align: center;
`;

export const InputWrapper = styled.div`
	width: 100%;
	margin-bottom: 12px;
`;

export const Input = styled.input`
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

export const Button = styled.button`
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

export const Subtitle = styled.h2`
	color: #764ba2;
	font-size: 18px;
	font-weight: 700;
	margin: 0 0 12px 0;
	text-align: center;
`;

export const RoomList = styled.div`
	width: 100%;
	max-width: 400px;
	margin: 0 auto;
	display: flex;
	flex-direction: column;
    max-height: 25vh;
    overflow-y: scroll;
	gap: 10px;
`;

export const RoomItem = styled.div`
	background: ${props => props.isPlaying ? '#ffe0e0' : '#f8faff'};
	border-radius: 10px;
	padding: 14px 18px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-shadow: 0 2px 8px rgba(102, 126, 234, 0.08);
	opacity: ${props => props.isPlaying ? 0.6 : 1};
`;

export const RoomInfo = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
`;

export const RoomName = styled.span`
	color: ${props => props.isPlaying ? '#c44569' : '#667eea'};
	font-size: 16px;
	font-weight: 700;
`;

export const RoomStatus = styled.span`
	color: ${props => props.isPlaying ? '#c44569' : '#764ba2'};
	font-size: 12px;
	font-weight: 600;
`;

export const RoomButton = styled.button`
	padding: 8px 16px;
	font-size: 14px;
	font-weight: 700;
	background: ${props => props.disabled ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
	color: ${props => props.disabled ? '#666' : '#fff'};
	border: none;
	border-radius: 8px;
	cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

	&:active:not(:disabled) {
		transform: scale(0.97);
		box-shadow: 0 2px 8px rgba(102, 126, 234, 0.18);
	}
`;