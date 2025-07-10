let socket: WebSocket | null = null;

// Tipos para as mensagens que podem ser enviadas
interface WebSocketMessage {
  type: string;
  payload: any;
}

let messageHandler: (message: any) => void;

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  // Determina dinamicamente o protocolo (ws ou wss) e o host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  // O Nginx irá redirecionar qualquer conexão para /ws
  const wsUrl = `${protocol}//${host}/ws`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => console.log('[WS] Conectado ao lobby.');
  socket.onclose = () => console.log('[WS] Desconectado do lobby.');
  socket.onerror = (err) => console.error('[WS] Erro:', err);

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('[WS] Mensagem recebida:', message);

      if (messageHandler) {
        messageHandler(message);
      }

    } catch (error) {
      console.error('[WS] Erro ao processar mensagem:', event.data);
    }
  };
}

export function initLobbyConnection(
  handler: (msg: any) => void,
) {
  messageHandler = handler;
  connect();
}


export function sendWebSocketMessage(messageObject: WebSocketMessage): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(messageObject));
  } else {
    console.warn('[WS] Tentativa de enviar mensagem quando o socket não está aberto.');
  }
}


export function sendChatMessage(text: string) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      payload: { text }
    }));
  }
}

export function disconnect() {
  if (socket) {
    socket.close();
  }
}