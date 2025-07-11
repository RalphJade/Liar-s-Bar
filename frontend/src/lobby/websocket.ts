let socket: WebSocket | null = null;

// Tipos para as mensagens que podem ser enviadas
interface WebSocketMessage {
  type: string;
  payload: any;
}

let messageHandler: (message: any) => void;
let reconnectInterval: number | null = null;
let reconnectionAttempt = 0;

function showReconnectionMessage(show: boolean) {
    let messageDiv = document.getElementById('reconnection-overlay');
    if (show && !messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'reconnection-overlay';
        messageDiv.className = 'reconnection-overlay'; 
        messageDiv.innerHTML = `<div class="reconnection-box">Connection lost. Attempting to reconnect...</div>`;
        document.body.appendChild(messageDiv);
    } else if (!show && messageDiv) {
        messageDiv.remove();
    }
}

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  let wsUrl: string;

  if (import.meta.env.DEV) {
    wsUrl = `ws://localhost:3001${window.location.pathname}`;
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const path = window.location.pathname;
    wsUrl = `${protocol}://${host}${path}`;
  }
  
  console.log(`[WS] Tentando conectar a: ${wsUrl}`); // Log de depuração útil
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('[WS] Conectado ao lobby.');
    showReconnectionMessage(false); // Esconde a mensagem de reconexão
    if (reconnectInterval) {
        clearInterval(reconnectInterval); // Para as tentativas de reconexão
        reconnectInterval = null;
    }
    reconnectionAttempt = 0;
    sendWebSocketMessage({ type: "LIST_ROOMS", payload: {} });
  };
  socket.onclose = () => {
    if (!socket || socket.onclose === null) return;
    console.log('[WS] Desconectado do lobby.');
    socket = null;
    showReconnectionMessage(true); // Mostra a mensagem
    
    // Tenta reconectar a cada 5 segundos
    if (!reconnectInterval) {
        reconnectInterval = window.setInterval(() => {
            console.log(`[WS] Tentativa de reconexão #${++reconnectionAttempt}...`);
            connect(); 
        }, 5000);
    }
  };
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
  sendWebSocketMessage({ type: 'CHAT_MESSAGE', payload: { text } });
}

export function disconnect() {
    if (socket) {
        socket.onclose = null;
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
        socket.close();
        socket = null;
        showReconnectionMessage(false);
    }
}