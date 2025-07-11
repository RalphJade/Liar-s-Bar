let socket: WebSocket | null = null;

// Tipos para as mensagens que podem ser enviadas
interface WebSocketMessage {
  type: string;
  payload: any;
}

let messageHandler: (message: any) => void;
let reconnectInterval: number | null = null;
let reconnectionAttempt = 0;
let pingInterval: number | null = null; // Timer to keep the connection active

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

function startPing() {
  // Stop any previous ping
  if (pingInterval) {
    clearInterval(pingInterval);
  }

  // Start a new ping timer every 5 seconds
  pingInterval = window.setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendWebSocketMessage({ type: 'PING', payload: {} });
    }
  }, 5000);
}

function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
    console.log('[WS] Ping stopped.');
  }
}

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  let wsUrl: string;

  if (import.meta.env.DEV) {
    wsUrl = `ws://localhost:3001/ws${window.location.pathname}`;
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const path = window.location.pathname;
    wsUrl = `${protocol}://${host}/ws${path}`;
  }

  console.log(`[WS] Attempting to connect to: ${wsUrl}`); // Useful debug log

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('[WS] Connected to lobby.');
    showReconnectionMessage(false); // Hide the reconnection message
    if (reconnectInterval) {
      clearInterval(reconnectInterval); // Stop reconnection attempts
      reconnectInterval = null;
    }
    reconnectionAttempt = 0;

    startPing();
    if (window.location.pathname === '/ws/home') {
      sendWebSocketMessage({ type: "LIST_ROOMS", payload: {} });
    }

  };

  socket.onclose = () => {
    if (!socket || socket.onclose === null) return;
    console.log('[WS] Disconnected from lobby.');
    socket = null;
    stopPing(); // Stop the ping system
    showReconnectionMessage(true); // Show the message

    // Try to reconnect every 5 seconds
    if (!reconnectInterval) {
      reconnectInterval = window.setInterval(() => {
        console.log(`[WS] Reconnection attempt #${++reconnectionAttempt}...`);
        connect();
      }, 5000);
    }
  };

  socket.onerror = (err) => console.error('[WS] Erro:', err);

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('[WS] Message received:', message);

      if (messageHandler) {
        messageHandler(message);
      }

    } catch (error) {
      console.error('[WS] Error processing message:', event.data);
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
    console.warn('[WS] Attempt to send message when socket is not open.');
  }
}


export function sendChatMessage(text: string) {
  sendWebSocketMessage({ type: 'CHAT_MESSAGE', payload: { text } });
}

export function disconnect() {
  stopPing(); // Stop the ping before closing the connection
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