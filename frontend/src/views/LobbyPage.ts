import { getUser } from "../auth/auth.ts";
import * as websocket from "../lobby/websocket.ts";
import * as lobbyState from "../lobby/lobbyState.ts";
import { navigate } from "../router/router.ts";

import { renderHeader } from "./components/Header.ts";

export const renderLobbyPage = (element: HTMLElement) => {
  const user = getUser();
  if (!user) {
    element.innerHTML = `<p>Erro: Usuário não autenticado.</p>`;
    return;
  }

  element.innerHTML = `
    <div id="header-container"></div>
    <!-- Conteúdo Principal do Lobby -->
    <main class="lobby-main">
    <div class="lobby-grid">
      <!-- Coluna Principal (Salas e Chat) -->
      <div class="lobby-main-column">
        <div id="lobbyContainer" class="card lobby-card">
          <div class="card-header">
            <h2 class="lobby-title">Available Rooms</h2>
            <div class="lobby-actions">
              <input type="search" id="roomSearchInput" class="form-input lobby-search" placeholder="Search...">
              <button id="createRoomBtn" class="button button-lobby-create">Create Room</button>
            </div>
          </div>
          <div id="roomList" class="scrollable-list">
            <p class="empty-list-message">No available rooms. Create the first one!</p>
          </div>
        </div>
        <div id="chatContainer" class="card lobby-card">
          <h3 class="lobby-subtitle">Saloon Chat</h3>
          <div id="chatMessages" class="scrollable-list chat-messages"></div>
          <form id="chatForm" class="chat-form">
            <input type="text" id="chatInput" class="form-input" placeholder="Say something..." required>
            <button type="submit" class="button button-lobby-send">Send</button>
          </form>
        </div>
      </div>
      <!-- Coluna Lateral (Jogadores Online) -->
      <aside class="lobby-side-column card lobby-card">
        <h3 class="lobby-subtitle">Players in the Bar</h3>
        <div id="onlineUserList" class="scrollable-list"></div>
      </aside>
      </div>
    </main>

    <!-- Modal de Criar Sala -->
    <div id="createRoomModal" class="modal-overlay hidden">
      <div class="modal-content">
        <button id="closeModalBtn" class="modal-close-btn">×</button>
        <h3 class="modal-title">Open a New Table</h3>
        <div class="modal-body">
          <form id="createRoomForm">
            <div class="form-group">
              <label for="roomNameInput" class="form-label">Table Name</label>
              <input type="text" id="roomNameInput" class="form-input" required>
            </div>
            <div class="form-group">
              <label for="roomPasswordInput" class="form-label">Password (optional)</label>
              <input type="password" id="roomPasswordInput" class="form-input">
            </div>
            <div class="form-actions">
              <button type="submit" class="button button-primary">Confirm</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const headerContainer = document.getElementById(
    "header-container"
  ) as HTMLElement;
  if (headerContainer) {
    renderHeader(headerContainer);
  }
  const onlineUserListDiv = document.getElementById("onlineUserList");
  const chatMessagesDiv = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput") as HTMLInputElement;
  const createRoomBtn = document.getElementById("createRoomBtn");
  const createRoomModal = document.getElementById("createRoomModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const createRoomForm = document.getElementById("createRoomForm");

  createRoomBtn?.addEventListener("click", () =>
    createRoomModal?.classList.remove("hidden")
  );
  closeModalBtn?.addEventListener("click", () =>
    createRoomModal?.classList.add("hidden")
  );

  createRoomForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const roomNameInput = document.getElementById(
      "roomNameInput"
    ) as HTMLInputElement;
    const roomPasswordInput = document.getElementById(
      "roomPasswordInput"
    ) as HTMLInputElement;

    if (!roomNameInput.value.trim()) {
      alert("Please enter a room name.");
      return;
    }
    if (roomPasswordInput.value && roomPasswordInput.value.length < 4) {
      alert("Password must be at least 4 characters long.");
      return;
    }

    websocket.sendWebSocketMessage({
      type: "CREATE_ROOM",
      payload: {
        roomName: roomNameInput.value,
        password: roomPasswordInput.value || undefined,
      },
    });
    roomNameInput.value = "";
    roomPasswordInput.value = "";
    createRoomModal?.classList.add("hidden");
  });

  chatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = chatInput.value;
    if (message.trim()) {
      websocket.sendChatMessage(message);
      chatInput.value = "";
    }
  });

  const renderOnlineUserList = () => {
    if (!onlineUserListDiv) return;
    onlineUserListDiv.innerHTML = "";

    const users = lobbyState.getOnlineUsers();
    users.forEach((user) => {
      const userElement = document.createElement("div");
      userElement.className = "online-user-item";
      userElement.textContent = user.username;
      onlineUserListDiv.appendChild(userElement);
    });
  };

  const renderChatMessages = () => {
    if (!chatMessagesDiv) return;
    chatMessagesDiv.innerHTML = "";
    const messages = lobbyState.getChatMessages();
    messages.forEach((msg) => {
      const msgElement = document.createElement("p");
      msgElement.className = "chat-message";
      msgElement.innerHTML = `<strong>${msg.username}:</strong> ${msg.text}`;
      chatMessagesDiv.appendChild(msgElement);
    });
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
  };

  const renderRoomList = () => {
    const roomListDiv = document.getElementById("roomList");
    if (!roomListDiv) return;

    const rooms = lobbyState.getRooms(); // Usa o estado igual ao chat e usuários

    if (rooms.length === 0) {
      roomListDiv.innerHTML =
        '<p class="empty-list-message">No available rooms. Create the first one!</p>';
      return;
    }

    roomListDiv.innerHTML = "";
    rooms.forEach((room) => {
      const roomElement = document.createElement("div");
      roomElement.className = "room-item";
      roomElement.innerHTML = `
        <div class="room-info">
          <h4 class="room-name">${room.name}</h4>
          <p class="room-details">
            ${room.currentPlayers}/${room.maxPlayers} players
            ${room.hasPassword ? "🔒" : ""}
          </p>
        </div>
        <button class="button button-lobby-join" data-room-code="${room.code}">
          Join
        </button>
      `;

      const joinBtn = roomElement.querySelector(".button-lobby-join");
      joinBtn?.addEventListener("click", () => {
        const roomCode = joinBtn.getAttribute("data-room-code");
        if (roomCode) {
          handleJoinRoom(roomCode, room.hasPassword);
        }
      });

      roomListDiv.appendChild(roomElement);
    });
  };

  const handleJoinRoom = (roomCode: string, hasPassword: boolean) => {
    if (hasPassword) {
      const password = prompt("Enter room password:");
      if (password === null) return; // User cancelled

      websocket.sendWebSocketMessage({
        type: "JOIN_ROOM",
        payload: { roomCode, password },
      });
    } else {
      websocket.sendWebSocketMessage({
        type: "JOIN_ROOM",
        payload: { roomCode },
      });
    }
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case "NEW_CHAT_MESSAGE":
        lobbyState.addMessage(message.payload);
        renderChatMessages();
        break;
      case "ONLINE_USER_LIST":
        lobbyState.setUsers(message.payload.users);
        renderOnlineUserList();
        break;
      case "USER_JOINED_LOBBY":
        lobbyState.addUser(message.payload.user);
        renderOnlineUserList();
        break;
      case "USER_LEFT_LOBBY":
        lobbyState.removeUser(message.payload.user.userId);
        renderOnlineUserList();
        break;
      case "ROOM_CREATED":
        lobbyState.addRoom({
          code: message.payload.roomCode,
          name: message.payload.roomName || message.payload.roomCode,
          currentPlayers: message.payload.currentPlayers || 1,
          maxPlayers: message.payload.maxPlayers || 4,
          hasPassword: !!message.payload.password,
        });
        renderRoomList(); // Renderiza novamente
        navigate(`/gameboard/${message.payload.roomCode}`);
        break;
      case "WAITING_ROOMS":
        lobbyState.setRooms(message.payload.rooms);
        renderRoomList();
        break;
      case "JOINED_ROOM":
        console.log("Joined room:", message.payload);
        navigate(`/gameboard/${message.payload.roomCode}`);
        break;
      case "ERROR":
        alert(`Error: ${message.payload.message}`);
    }
  };

  websocket.initLobbyConnection(handleWebSocketMessage);

  renderOnlineUserList();
  renderChatMessages();
  renderRoomList();
};
