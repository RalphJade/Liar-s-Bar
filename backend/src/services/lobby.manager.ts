import { WebSocket } from "ws";
import { CustomWebSocket } from '../models/types.model';

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
export function broadcastOnlineUserList() {
    const users = Array.from(connectedClients.values()).map(client => ({
        userId: client.clientId,
        username: client.clientUsername,
        status: client.currentRoomCode ? 'In Game' : 'In Lobby' 
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