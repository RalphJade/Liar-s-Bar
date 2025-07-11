import { WebSocket } from "ws";
import { CustomWebSocket, ChatMessage } from '../models/types.model';
import { sendToClient } from "../utils/websocket.util";

const connectedClients = new Map<string, CustomWebSocket>();
const lobbyChatHistory: ChatMessage[] = [];

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
export function handleChatMessage(sender: CustomWebSocket, payload: any) {
    if (typeof payload.text !== 'string' || payload.text.trim() === '') {
        return; // Ignora mensagens vazias ou mal formatadas
    }

    const chatMessage: ChatMessage = {
        authorId: sender.clientId,
        authorName: sender.clientUsername,
        message: payload.text.trim(),
        timestamp: new Date().toISOString()
    };
    
    lobbyChatHistory.push(chatMessage);
    if (lobbyChatHistory.length > 100) {
        lobbyChatHistory.shift();
    }

    const messageToBroadcast = {
        type: 'LOBBY_CHAT_MESSAGE',
        payload: chatMessage
    };
    broadcastToLobby(messageToBroadcast);
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

    broadcastToLobby(message);
}

/**
 * Envia uma mensagem para TODOS os clientes conectados no lobby.
 */
export function broadcast(message: object) {
  const serializedMessage = JSON.stringify(message);
  for (const client of connectedClients.values()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serializedMessage);
    }
  }
}

function broadcastToLobby(message: object) {
  const serializedMessage = JSON.stringify(message);
  for (const client of connectedClients.values()) {
    if (!client.currentRoomCode && client.readyState === WebSocket.OPEN) {
      client.send(serializedMessage);
    }
  }
}

/**
 * Envia a lista atual de usuários online para um cliente específico.
 */
export function sendOnlineUserList(ws: CustomWebSocket) {
    const users = Array.from(connectedClients.values()).map(client => ({
        userId: client.clientId,
        username: client.clientUsername,
        status: client.currentRoomCode ? 'In Game' : 'In Lobby' 
    }));

    const message = {
        type: 'ONLINE_USER_LIST',
        payload: { users }
    };

    ws.send(JSON.stringify(message));
}

export function sendLobbyChatHistory(ws: CustomWebSocket) {
    lobbyChatHistory.forEach(chatMessage => {
        // Envia cada mensagem do histórico para o cliente que acabou de conectar.
        sendToClient(ws, "LOBBY_CHAT_MESSAGE", chatMessage);
    });
}