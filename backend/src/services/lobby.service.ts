import { WebSocket, Server as WebSocketServer } from "ws";
import { CustomWebSocket } from './game.service';

export function initializeLobbyService(wss: WebSocketServer) {
  wss.on('connection', (ws: CustomWebSocket) => {
    // Passa a conexão para o nosso serviço de lobby
    handleNewConnection(ws);

    ws.on('message', (messageBuffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        // Direciona a mensagem para o handler apropriado
        if (message.type === 'CHAT_MESSAGE') {
          handleChatMessage(ws, message.payload);
        }
        // Aqui você pode adicionar outros tipos de mensagem (ex: CRIAR_SALA)
      } catch (error) {
        console.error('Mensagem WebSocket mal formatada:', messageBuffer.toString());
      }
    });

    ws.on('close', () => {
      // Passa a desconexão para o nosso serviço de lobby
      handleDisconnect(ws);
    });
  });
}

// Map para manter o estado dos clientes conectados no lobby.
// A chave é o userId, e o valor é a própria conexão WebSocket.
const connectedClients = new Map<string, CustomWebSocket>();

/**
 * Adiciona um novo cliente à lista de conectados e notifica a todos.
 */
export function handleNewConnection(ws: CustomWebSocket) {
  const { clientId, clientUsername } = ws;
  
  // Adiciona o cliente ao nosso "banco de dados em memória" de usuários online.
  connectedClients.set(clientId, ws);
  console.log(`[Lobby] Usuário conectado: ${clientUsername} (ID: ${clientId}). Total: ${connectedClients.size}`);

  broadcastOnlineUserList();
}

/**
 * Remove um cliente desconectado e notifica a todos.
 */
export function handleDisconnect(ws: CustomWebSocket) {
  const { clientId, clientUsername } = ws;

  connectedClients.delete(clientId);
  console.log(`[Lobby] Usuário desconectado: ${clientUsername} (ID: ${clientId}). Total: ${connectedClients.size}`);

  broadcastOnlineUserList();
}

/**
 * Processa uma mensagem de chat recebida de um cliente e a retransmite.
 */
export function handleChatMessage(sender: CustomWebSocket, message: any) {
    if (typeof message.text !== 'string' || message.text.trim() === '') {
        return; // Ignora mensagens vazias ou mal formatadas
    }

    const chatMessage = {
        type: 'NEW_CHAT_MESSAGE',
        payload: {
            userId: sender.clientId,
            username: sender.clientUsername,
            text: message.text.trim(),
            timestamp: new Date().toISOString()
        }
    };
    broadcast(chatMessage);
}

/**
 * Monta a lista de usuários online e a envia para todos os clientes.
 */
function broadcastOnlineUserList() {
    const users = Array.from(connectedClients.values()).map(client => ({
        userId: client.clientId,
        username: client.clientUsername
    }));

    const message = {
        type: 'ONLINE_USER_LIST', // Usa sempre o mesmo tipo de mensagem para a lista
        payload: { users }
    };

    broadcast(message);
}

/**
 * Envia uma mensagem para TODOS os clientes conectados no lobby.
 */
function broadcast(message: object) {
  const serializedMessage = JSON.stringify(message);
  for (const client of connectedClients.values()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serializedMessage);
    }
  }
}

/**
 * Envia a lista atual de usuários online para um cliente específico.
 */
function sendOnlineUserList(ws: CustomWebSocket) {
    const users = Array.from(connectedClients.values()).map(client => ({
        userId: client.clientId,
        username: client.clientUsername
    }));

    const message = {
        type: 'ONLINE_USER_LIST',
        payload: { users }
    };

    ws.send(JSON.stringify(message));
}