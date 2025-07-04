let socket: WebSocket | null = null;

// Funções para a UI chamar
let messageHandler: (message: any) => void;

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  const wsUrl = `ws://localhost:3001`; // Ajuste se necessário
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