import { getRoom, addRoom, getAllRooms, getAvailableRooms, removeRoom, getRoomHands, addRoomMessage, getRoomChatHistory } from './gameState';
import { log } from "../utils/logger";
import {
  sendToClient,
  broadcastToRoom,
  broadcastToOthers,
} from "../utils/websocket.util";
import { Room, CustomWebSocket, CardGame } from "../models/types.model";
import { generateCodeWithFaker } from "../utils/room.util";
import { getRoomStateForApi, broadcastRoomState } from '../utils/websocket.util';
import { startCardGame, advanceTurnAfterInterruption } from "./game-logic";
import { MAX_PLAYERS, TURN_TIME_LIMIT, RECONNECTION_TIME_LIMIT } from "../config/game.config";
import * as LobbyManager from "./lobby.manager";

/**
 * Handles a request from a user to create a new game room.
 * @param ws The WebSocket connection of the user creating the room.
 * @param payload The room details (name, password).
 */
export async function handleCreateRoom(
  ws: CustomWebSocket,
  payload: { roomName: string; password?: string }
): Promise<void> {
  if (ws.currentRoomCode) {
    log( `User ${ws.clientUsername} tried to create a room but is already in another one.`, { ws } );
    sendToClient(ws, "ERROR", {
      message: "You are already in a room. Please leave your current room to create a new one.",
    });
    return;
  }

  const { roomName, password } = payload;
  const roomCode = generateCodeWithFaker();
  
  const newRoom: Room = {
    roomName,
    roomCode,
    ownerId: ws.clientId,
    status: "waiting",
    players: new Map(),
    spectators: new Map(),
    password: password || undefined,
    choices: new Map(),
  };

  const roomWithGame: Room & { game: CardGame } = {
    ...newRoom,
    game: {
      deck: [],
      currentPlayerIndex: 0,
      direction: 1,
      phase: "waiting",
      roundNumber: 0,
      turnTimeLimit: TURN_TIME_LIMIT,
      turnTimer: null,
      currentCardType: null,
      playedCards: [],
      lastPlayedCard: [],
      lastPlayerId: null,
    },
  };

  roomWithGame.players.set(ws.clientId, {
    username: ws.clientUsername,
    ws,
  });

  addRoom(roomCode, roomWithGame);
  ws.currentRoomCode = roomCode;
  log(`Room ${roomCode} created by ${ws.clientUsername}.`, { ws });

  sendToClient(ws, "JOINED_ROOM", {
    roomCode: roomWithGame.roomCode,
    asSpectator: false,
    message: `You created and joined the room ${roomWithGame.roomName}.`,
  });

  LobbyManager.broadcast({
    type: "ROOM_CREATED",
    payload: {
      code: roomWithGame.roomCode,
      name: roomWithGame.roomName,
      currentPlayers: roomWithGame.players.size,
      maxPlayers: MAX_PLAYERS,
      hasPassword: !!roomWithGame.password,
      ownerId: roomWithGame.ownerId,
    },
  });
  
  const roomState = await getRoomStateForApi(roomWithGame, ws.clientId);
  sendToClient(ws, "ROOM_STATE_UPDATE", roomState);

  // Notifica que precisa de mais jogadores
  if (roomWithGame.players.size < MAX_PLAYERS) {
  LobbyManager.broadcast({
    type: "WAITING_ROOMS",
    payload: {
      rooms: getAvailableRooms().map((room) => ({
        code: room.roomCode,
        name: room.roomName,
        currentPlayers: room.players.size,
        maxPlayers: MAX_PLAYERS,
        hasPassword: !!room.password,
      })),
    },
  });
  }

  LobbyManager.broadcastOnlineUserList();
}

/**
 * Handles a request from a user to join an existing game room.
 * @param ws The WebSocket connection of the user joining.
 * @param payload The join details (room code, password).
 */
export async function handlePlayerJoinRoom(
  ws: CustomWebSocket,
  payload: { roomCode: string; password?: string }
): Promise<void> {
  const { roomCode, password } = payload;

  if (ws.currentRoomCode) {
    sendToClient(ws, "ERROR", { message: "You are already in a room. Please leave your current room to join a new one." });
    return;
  }

  const room = getRoom(roomCode.toUpperCase());
  if (!room) {
    sendToClient(ws, "ERROR", { message: "Room not found." });
    return;
  }

  if (room.password && room.password !== password) {
    sendToClient(ws, "ERROR", { message: "Incorrect password." });
    return;
  }

  if (room.status === "playing") {
      sendToClient(ws, "ERROR", { message: "This game is already in progress. You can join as a spectator." });
      return;
  }

  if (room.players.size >= MAX_PLAYERS) {
    sendToClient(ws, "ERROR", { message: "This room is full. You will be added as a spectator." });
    // Logic to add as spectator can be implemented here if desired.
    return;
  }

  room.players.set(ws.clientId, {
    username: ws.clientUsername,
    ws,
  });
  ws.currentRoomCode = roomCode.toUpperCase();

  log(`Player ${ws.clientUsername} joined room ${roomCode} (${room.players.size}/${MAX_PLAYERS}).`, { ws });

  sendToClient(ws, "JOINED_ROOM", {
    roomCode: room.roomCode,
    asSpectator: false,
    message: `You have joined room ${room.roomName}.`,
  });

  await broadcastRoomState(room);

  if (room.players.size === MAX_PLAYERS) {
    log(`Room ${room.roomCode} is full. Starting game.`);
    startCardGame(room);
  } else {
    log(
      `Sala ${room.roomCode} tem ${room.players.size} jogadores. Aguardando mais jogadores.`,
      { ws }
    );
  }
  
  // Envia o estado atual da sala
  broadcastRoomState(room);
}

export function handleWaitingRooms(ws: CustomWebSocket): void {
  const availableRooms = getAvailableRooms();
  sendToClient(ws, "WAITING_ROOMS", {
    rooms: availableRooms.map((room) => ({
      code: room.roomCode,
      name: room.roomName,
      currentPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS,
      hasPassword: !!room.password,
    })),
  });
}

/**
 * Handles a request from a player to be ready for the next game.
 * @param ws The client's WebSocket connection.
 */
export function handleReadyForNextGame(ws: CustomWebSocket): void {
  const roomCode = ws.currentRoomCode;
  if (!roomCode) {
    sendToClient(ws, "ERROR", { message: "You must be in a room to signal readiness." });
    return;
  }

  const room = getRoom(roomCode);
  if (!room) return;

  const roomHands = getRoomHands(room.roomCode);
  if (!roomHands) return;

  const playerHand = roomHands.get(ws.clientId);
  if (!playerHand) return;

  playerHand.isReady = true;

  const allReady = Array.from(room.players.keys()).every((playerId) => roomHands.get(playerId)?.isReady);

  if (allReady) {
    startCardGame(room);
  } else {
    const readyCount = Array.from(roomHands.values()).filter(h => h.isReady).length;
  }
}

/**
 * Handles the room owner closing the room, notifying all participants.
 * @param ws The room owner's WebSocket connection.
 */
export function handleCloseRoom(ws: CustomWebSocket): void {
  const roomCode = ws.currentRoomCode;
  if (!roomCode) return;

  const room = getRoom(roomCode);
  if (!room || room.ownerId !== ws.clientId) {
      sendToClient(ws, "ERROR", { message: "You are not the owner of this room." });
      return;
  }
  
  log(`Owner ${ws.clientUsername} is closing room ${roomCode}.`);

  const allParticipants = [...room.players.values(), ...room.spectators.values()];

  // 1. Notificar a todos que a sala está fechando
  broadcastToRoom(room, "ROOM_CLOSED", {
    code: roomCode,
    name: room.roomName,
  });

  // 2. ALTERADO: Limpar o estado de cada participante no servidor
  allParticipants.forEach(participant => {
    if (participant.ws) {
      participant.ws.currentRoomCode = undefined;
      LobbyManager.broadcastOnlineUserList();
    }
  });

  // 3. Remover a sala do estado global
  removeRoom(roomCode);
  
  // 4. Notificar o lobby que a sala foi removida
  LobbyManager.broadcast({
    type: "ROOM_REMOVED", // Você pode usar essa mensagem no frontend para atualizar a lista
    payload: { code: roomCode }
  });
}

/**
 * Handles a player leaving a room. If the owner leaves, the room is closed.
 * @param ws The WebSocket of the player leaving.
 */
export async function handleLeaveRoom(ws: CustomWebSocket): Promise<void> {
  const roomCode = ws.currentRoomCode;
  if (!roomCode) {
    sendToClient(ws, "ERROR", { message: "You are not in a room." });
    return;
  }

  const room = getRoom(roomCode);
  if (!room) {
    ws.currentRoomCode = undefined;
    LobbyManager.broadcastOnlineUserList();
    return;
  }
  
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
  }
    
  if (room.ownerId === ws.clientId) {
    log(`Dono ${ws.clientUsername} saiu da sala ${roomCode}, fechando a sala.`);
    handleCloseRoom(ws); 
    return;
  }
  
  let playerLeft = false;
  if (room.players.has(ws.clientId)) {
    log(`Jogador ${ws.clientUsername} saiu da sala ${room.roomCode}.`);
    room.players.delete(ws.clientId);
    playerLeft = true;
  } else if (room.spectators.has(ws.clientId)) {
    log(`Espectador ${ws.clientUsername} saiu da sala ${room.roomCode}.`);
    room.spectators.delete(ws.clientId);
  }

  ws.currentRoomCode = undefined;
  sendToClient(ws, "LEFT_ROOM", { message: `You have left the room ${room.roomName}.` });
  LobbyManager.broadcastOnlineUserList();

  if (playerLeft) {
    const notificationMessage = `${ws.clientUsername} has left the table.`;
    const chatMessage = { authorId: 'system', authorName: 'System', message: notificationMessage, timestamp: new Date().toISOString() };
    addRoomMessage(roomCode, chatMessage);
    broadcastToRoom(room, "ROOM_CHAT_MESSAGE", chatMessage);

    if (room.status === 'playing') {
      advanceTurnAfterInterruption(room);
    }
  }

  broadcastRoomState(room);

  LobbyManager.broadcast({ 
    type: "WAITING_ROOMS", 
    payload: { 
      rooms: getAvailableRooms().map((r) => ({
        code: r.roomCode,
        name: r.roomName,
        currentPlayers: r.players.size,
        maxPlayers: MAX_PLAYERS,
        hasPassword: !!r.password,
      })) 
    }, 
  });
}

export function handlePlayerDisconnect(ws: CustomWebSocket): void {
  const roomCode = ws.currentRoomCode;
  
  if (!roomCode) {
    LobbyManager.handleDisconnect(ws);
    return;
  }

  const room = getRoom(roomCode);
  if (!room) {
    LobbyManager.handleDisconnect(ws);
    return;
  }

  // Lógica para Espectadores (eles são removidos imediatamente)
  if (room.spectators.has(ws.clientId)) {
    log(`Espectador ${ws.clientUsername} desconectou da sala ${room.roomCode}.`, { ws });
    room.spectators.delete(ws.clientId);
    broadcastRoomState(room); // Notifica a sala da saída do espectador
    LobbyManager.handleDisconnect(ws); // Remove da lista global de clientes
    return;
  }
  
  // Lógica para Jogadores (eles entram em modo de reconexão)
  const participant = room.players.get(ws.clientId);
  if (participant) {
    log(`Jogador ${ws.clientUsername} desconectou. Iniciando timer de reconexão...`, { ws });
    participant.ws = null; // Marca como offline

    const deadline = Date.now() + RECONNECTION_TIME_LIMIT;
    participant.reconnectingUntil = deadline;

    // Notifica a sala que o jogador desconectou e o estado mudou
    const chatMessage = {
      authorId: 'system',
      authorName: 'System',
      message: `${ws.clientUsername} has disconnected. They have ${RECONNECTION_TIME_LIMIT / 1000} seconds to reconnect.`,
      timestamp: new Date().toISOString(),
    };
    addRoomMessage(roomCode, chatMessage);
    broadcastToRoom(room, "ROOM_CHAT_MESSAGE", chatMessage);
    broadcastRoomState(room); // Atualiza a UI para mostrar o jogador como offline

    // Se era o turno dele, avança o jogo
    if (room.status === 'playing') {
      const playerIds = Array.from(room.players.keys());
      if (playerIds[room.game.currentPlayerIndex] === ws.clientId) {
        advanceTurnAfterInterruption(room);
      }
    }

    // Inicia o timer para remoção permanente
    participant.disconnectionTimer = setTimeout(() => {
      // Este código só roda se o jogador não se reconectar a tempo
      
      // Precisamos buscar o estado mais recente da sala, caso algo tenha mudado
      const currentRoomState = getRoom(roomCode);
      if (!currentRoomState) return; // A sala pode ter sido fechada enquanto o timer rodava

      const playerStillInRoom = currentRoomState.players.get(ws.clientId);

      // Só remove se ele ainda estiver na sala e ainda estiver desconectado
      if (playerStillInRoom && playerStillInRoom.ws === null) {
        const disconnectedUsername = participant.username

        log(`Tempo de reconexão esgotado para ${ws.clientUsername}. Removendo permanentemente.`);
        
        currentRoomState.players.delete(ws.clientId);
        
        // Notifica a sala sobre a remoção por timeout
        const removalMessage = { 
          authorId: 'system',
          authorName: 'System',
          message: `${disconnectedUsername} did not reconnect in time and has been removed from the table.`,
          timestamp: new Date().toISOString(),
        };
        addRoomMessage(roomCode, removalMessage);
        broadcastToRoom(currentRoomState, "ROOM_CHAT_MESSAGE", removalMessage);
        
        // Agora que ele foi removido permanentemente do jogo,
        // também o removemos da lista global de clientes conectados.
        LobbyManager.handleDisconnect(ws);

        // Verifica se a sala ficou vazia ou se o jogo acabou
        if (currentRoomState.players.size === 0) {
            log(`Room ${roomCode} is now empty. Closing room.`);
            removeRoom(roomCode);
            LobbyManager.broadcast({ type: "ROOM_REMOVED", payload: { code: roomCode } });
        } else {
            // Se ainda há jogadores, verifica se temos um vencedor
            if (currentRoomState.status === 'playing') {
                advanceTurnAfterInterruption(currentRoomState);
            }
            // Atualiza a UI de todos na sala
            broadcastRoomState(currentRoomState);
        }
      }
    }, RECONNECTION_TIME_LIMIT);
  }
}

/**
 * Constructs a serializable version of the room state for API responses.
 * @param room The full room object.
 * @param currentUserId The ID of the user requesting the state.
 * @returns {Promise<RoomStateForApi>} A safe, serializable version of the room state.
 */

export async function attemptPlayerReconnection(ws: CustomWebSocket): Promise<'reconnected' | 'not_found'> {
  for (const room of getAllRooms()) {
    const participant = room.players.get(ws.clientId) || room.spectators.get(ws.clientId);
    
    if (participant && participant.ws === null) {

      if (participant.disconnectionTimer) {
        clearTimeout(participant.disconnectionTimer);
        participant.disconnectionTimer = undefined;
        log(`Timer de remoção para ${ws.clientUsername} cancelado com sucesso.`);
      }
      participant.reconnectingUntil = undefined;
      log(`Reconectando ${ws.clientUsername} à sala ${room.roomCode}.`, { ws });
      
      participant.ws = ws;
      ws.currentRoomCode = room.roomCode;
      
      const chatMessage = {
          authorId: 'system',
          authorName: 'System',
          message: `${participant.username} has reconnected!`,
          timestamp: new Date().toISOString(),
      };
      addRoomMessage(room.roomCode, chatMessage);
      
      broadcastRoomState(room);
      
      const chatHistory = getRoomChatHistory(room.roomCode);
      chatHistory.forEach(msg => {
          sendToClient(ws, "ROOM_CHAT_MESSAGE", msg);
      });

      return 'reconnected';
    }
  }
  return 'not_found';
}

export function handleRoomChatMessage(ws: CustomWebSocket, payload: { message: string }): void {
    const roomCode = ws.currentRoomCode;
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;

    const message = payload.message.trim();
    if (message) {
        const chatMessage = {
            authorId: ws.clientId,
            authorName: ws.clientUsername,
            message: message,
            timestamp: new Date().toISOString(),
        };
        addRoomMessage(roomCode, chatMessage);
        broadcastToRoom(room, "ROOM_CHAT_MESSAGE", chatMessage);
    }
}