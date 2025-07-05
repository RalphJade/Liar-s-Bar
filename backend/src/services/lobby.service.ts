import { WebSocket } from 'ws';

// Anexa informações do usuário à instância do WebSocket para fácil acesso.
interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  username: string;
}

// Map para manter o estado dos clientes conectados no lobby.
// A chave é o userId, e o valor é a própria conexão WebSocket.
const connectedClients = new Map<string, AuthenticatedWebSocket>();

/**
 * Adiciona um novo cliente à lista de conectados e notifica a todos.
 */
export function handleNewConnection(ws: AuthenticatedWebSocket) {
  const { userId, username } = ws;
  
  // Adiciona o cliente ao nosso "banco de dados em memória" de usuários online.
  connectedClients.set(userId, ws);
  console.log(`[Lobby] Usuário conectado: ${username} (ID: ${userId}). Total: ${connectedClients.size}`);

  broadcastOnlineUserList();
}

/**
 * Remove um cliente desconectado e notifica a todos.
 */
export function handleDisconnect(ws: AuthenticatedWebSocket) {
  const { userId, username } = ws;

  connectedClients.delete(userId);
  console.log(`[Lobby] Usuário desconectado: ${username}. Total: ${connectedClients.size}`);
  
  broadcastOnlineUserList();
}

/**
 * Processa uma mensagem de chat recebida de um cliente e a retransmite.
 */
export function handleChatMessage(sender: AuthenticatedWebSocket, message: any) {
    if (typeof message.text !== 'string' || message.text.trim() === '') {
        return; // Ignora mensagens vazias ou mal formatadas
    }

    const chatMessage = {
        type: 'NEW_CHAT_MESSAGE',
        payload: {
            userId: sender.userId,
            username: sender.username,
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
        userId: client.userId,
        username: client.username
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
function sendOnlineUserList(ws: AuthenticatedWebSocket) {
    const users = Array.from(connectedClients.values()).map(client => ({
        userId: client.userId,
        username: client.username
    }));

    const message = {
        type: 'ONLINE_USER_LIST',
        payload: { users }
    };

    ws.send(JSON.stringify(message));
}