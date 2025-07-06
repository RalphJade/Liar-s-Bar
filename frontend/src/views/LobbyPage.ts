// frontend/src/views/LobbyPage.ts

import { getUser, logout } from '../auth/auth.ts';
import * as websocket from '../lobby/websocket.ts';

interface User {
  userId: string;
  username: string;
}

export const renderLobbyPage = (element: HTMLElement) => {
  const user = getUser();
  if (!user) {
    element.innerHTML = `<p>Erro: Usuário não autenticado.</p>`;
    return;
  }

  document.body.className = 'lobby-theme';

  // O HTML está perfeito, sem alterações aqui.
  element.innerHTML = `
    <!-- ... seu HTML completo do lobby ... -->
    <nav class="lobby-navbar">
      <h1>Liar's Bar</h1>
      <div class="user-info">
        <span>Bem-vindo, ${user.username}</span>
        <button id="rulesBtn" class="button button-primary">Regras</button>
        <button id="logoutBtn" class="button button-danger">Sair</button>
      </div>
    </nav>
    <main class="lobby-main">
        <div class="lobby-main-column">
            <div id="lobbyContainer" class="card">
                <div class="card-header">
                    <h2 class="card-title">Lobby</h2>
                    <div class="lobby-header-controls">
                        <input type="search" id="roomSearchInput" class="form-input" placeholder="Pesquisar por nome ou ID...">
                        <button id="createRoomBtn" class="button button-create">Criar Sala</button>
                    </div>
                </div>
                <div id="roomList" class="scrollable-list"><p>Carregando salas...</p></div>
            </div>
            <div id="chatContainer" class="card">
                <h3 class="card-title" style="font-size: 1.25rem; border-bottom: 1px solid var(--dark-border); padding-bottom: 0.5rem; margin-bottom: 1rem;">Chat Global</h3>
                <div id="chatMessages" class="scrollable-list"></div>
                <form id="chatForm">
                    <input type="text" id="chatInput" class="form-input" placeholder="Digite sua mensagem..." required>
                    <button type="submit" class="button button-chat">Enviar</button>
                </form>
            </div>
        </div>
        <aside class="lobby-side-column card">
            <h3 class="card-title">Jogadores Online</h3>
            <div id="onlineUserList" class="scrollable-list"></div>
        </aside>
    </main>
    <div id="createRoomModal" class="modal-overlay hidden">
        <div class="card">
          <div class="card-content">
            <h3 class="form-title">Criar Nova Sala</h3>
            <form id="createRoomForm">
              <div class="form-group"><label for="roomNameInput" class="form-label">Nome da Sala</label><input type="text" id="roomNameInput" class="form-input" required></div>
              <div class="form-group"><label for="roomPasswordInput" class="form-label">Senha (opcional)</label><input type="password" id="roomPasswordInput" class="form-input"></div>
              <div class="modal-actions"><button type="button" id="cancelCreateRoomBtn" class="button button-danger">Cancelar</button><button type="submit" class="button button-create">Criar</button></div>
            </form>
          </div>
        </div>
    </div>
  `;

  // --- OBTENDO REFERÊNCIAS PARA OS ELEMENTOS ---
  const onlineUserListDiv = document.getElementById('onlineUserList');
  const chatMessagesDiv = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput') as HTMLInputElement;
  const logoutBtn = document.getElementById('logoutBtn');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const createRoomModal = document.getElementById('createRoomModal');
  const cancelCreateRoomBtn = document.getElementById('cancelCreateRoomBtn');
  const createRoomForm = document.getElementById('createRoomForm');

  // --- ESTADO LOCAL DA PÁGINA ---
  let onlineUsers: User[] = [];

  // --- FUNÇÕES DE RENDERIZAÇÃO E MANIPULAÇÃO DE ESTADO (Consolidadas) ---

  const renderOnlineUserList = () => {
    if (!onlineUserListDiv) return;
    onlineUserListDiv.innerHTML = '';
    onlineUsers.forEach(user => {
      const userElement = document.createElement('div');
      userElement.className = 'online-user-item';
      userElement.textContent = user.username;
      onlineUserListDiv.appendChild(userElement);
    });
  };

  const addChatMessage = (msg: { username: string, text: string }) => {
    if (!chatMessagesDiv) return;
    const msgElement = document.createElement('p');
    // Adiciona uma classe para poder estilizar as mensagens de chat
    msgElement.className = 'chat-message';
    msgElement.innerHTML = `<strong>${msg.username}:</strong> ${msg.text}`;
    chatMessagesDiv.appendChild(msgElement);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
  };

  // --- O GERENCIADOR DE MENSAGENS WEBSOCKET ---
  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'NEW_CHAT_MESSAGE':
        addChatMessage(message.payload);
        break;
      
      // Casos para a lista de usuários:
      case 'ONLINE_USER_LIST':
        onlineUsers = message.payload.users;
        renderOnlineUserList();
        break;
      case 'USER_JOINED_LOBBY':
        // Adiciona o novo usuário à lista se ele não estiver lá
        if (!onlineUsers.some(u => u.userId === message.payload.user.userId)) {
          onlineUsers.push(message.payload.user);
          renderOnlineUserList();
        }
        break;
      case 'USER_LEFT_LOBBY':
        // Remove o usuário da lista
        onlineUsers = onlineUsers.filter(u => u.userId !== message.payload.user.userId);
        renderOnlineUserList();
        break;
    }
  };

  // --- CONEXÃO E EVENT LISTENERS ---

  // Conecta ao WebSocket e passa o nosso handler unificado.
  websocket.initLobbyConnection(handleWebSocketMessage);

  // Event Listeners para a interatividade da página
  logoutBtn?.addEventListener('click', () => {
    websocket.disconnect();
    logout();
  });

  createRoomBtn?.addEventListener('click', () => createRoomModal?.classList.remove('hidden'));
  cancelCreateRoomBtn?.addEventListener('click', () => createRoomModal?.classList.add('hidden'));

  createRoomForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    websocket.sendWebSocketMessage({"type": "CREATE_ROOM", "payload": {}});
    createRoomModal?.classList.add('hidden');
  });

  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value;
    if (message.trim()) {
      websocket.sendChatMessage(message);
      chatInput.value = '';
    }
  });
};