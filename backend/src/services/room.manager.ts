import { getRoom, addRoom, getAllRooms, removeRoom, getRoomHands, addRoomMessage, getRoomChatHistory } from './gameState';
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
      lastPlayedCard: null,
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
      rooms: getAllRooms().map((room) => ({
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
  const allRooms = getAllRooms();
  const availableRooms = allRooms.filter((room) => room.status === "waiting");
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

  broadcastToRoom(room, "ROOM_CLOSED", {
    code: roomCode,
    name: room.roomName,
  });

  removeRoom(roomCode);
  
  LobbyManager.broadcast({
    type: "ROOM_REMOVED",
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
  if (!room) return;

  log(`Sala ${room.roomCode} está sendo fechada pelo dono ${ws.clientUsername}.`, { ws });
  
  // Cancela timer se existir
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
  }
  
  const closePayload = { message: `A sala ${room.roomCode} foi fechada pelo dono.` };
  
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(p => {
    if (p.ws) {
      sendToClient(p.ws, "ROOM_CLOSED", closePayload);
      p.ws.currentRoomCode = "";
    }
  });

  // Remove mãos dos jogadores
  removeRoom(roomCode)
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

  const participant = room.players.get(ws.clientId);
  const isPlayer = !!participant;

  if (isPlayer && participant) {
    log(`Jogador ${ws.clientUsername} desconectou da sala ${room.roomCode}.`, { ws });
    participant.ws = null;

    const chatMessage = {
        authorId: 'system',
        authorName: 'System',
        message: `${ws.clientUsername} has disconnected.`,
        timestamp: new Date().toISOString(),
    };
    
    addRoomMessage(roomCode, chatMessage);

    broadcastToRoom(room, "CHAT_BROADCAST", chatMessage);
    
    if (room.status === 'playing') {
        const playerIds = Array.from(room.players.keys());
        if (playerIds[room.game.currentPlayerIndex] === ws.clientId) {
            advanceTurnAfterInterruption(room);
        }
    }

    participant.disconnectionTimer = setTimeout(() => {
      
      const currentRoomState = getRoom(roomCode);
      const playerStillDisconnected = currentRoomState?.players.get(ws.clientId)?.ws === null;

      if (playerStillDisconnected) {
        log(`Tempo de reconexão esgotado para ${ws.clientUsername}. Removendo da sala ${roomCode}.`);
        
        currentRoomState.players.delete(ws.clientId);
        
        const removalMessage = { authorId: 'system', authorName: 'System', message: `${ws.clientUsername} was removed for being disconnected too long.`, timestamp: new Date().toISOString() };
        addRoomMessage(roomCode, removalMessage);
        broadcastToRoom(currentRoomState, "CHAT_BROADCAST", removalMessage);
        
        broadcastRoomState(currentRoomState);
        
        if (currentRoomState.players.size === 0) {
            log(`Sala ${roomCode} ficou vazia e foi fechada.`);
            removeRoom(roomCode);
            LobbyManager.broadcast({ type: "ROOM_REMOVED", payload: { code: roomCode } });
        }
      }
    }, RECONNECTION_TIME_LIMIT);

  } else {
    room.spectators.delete(ws.clientId);
    log(`Espectador ${ws.clientUsername} desconectou da sala ${room.roomCode}.`, { ws });
  }

  broadcastRoomState(room);
  
  LobbyManager.handleDisconnect(ws);
}

/**
 * Constructs a serializable version of the room state for API responses.
 * @param room The full room object.
 * @param currentUserId The ID of the user requesting the state.
 * @returns {Promise<RoomStateForApi>} A safe, serializable version of the room state.
 */

export async function attemptPlayerReconnection(ws: CustomWebSocket): Promise<boolean> {
  for (const room of getAllRooms()) {
    const participant = room.players.get(ws.clientId) || room.spectators.get(ws.clientId);
    
    if (participant && participant.ws === null) {

      if (participant.disconnectionTimer) {
        clearTimeout(participant.disconnectionTimer);
        participant.disconnectionTimer = undefined;
        log(`Timer de remoção para ${ws.clientUsername} cancelado com sucesso.`);
      }

      log(`Reconectando ${ws.clientUsername} à sala ${room.roomCode}.`, { ws });
      
      participant.ws = ws;
      ws.currentRoomCode = room.roomCode;
      
      broadcastToOthers(room, ws, "PLAYER_RECONNECTED", {
        playerId: ws.clientId,
        playerName: ws.clientUsername,
        message: `${ws.clientUsername} reconnected!`
      });

      // Envia estado da sala
      const roomState = await getRoomStateForApi(room, ws.clientId);
      sendToClient(ws, "ROOM_STATE_UPDATE", roomState);
      
      // Envia cartas se for jogador
      if (room.players.has(ws.clientId)) {
        const roomHands = getRoomHands(room.roomCode);
        const playerHand = roomHands?.get(ws.clientId);
        
        if (playerHand) {
          sendToClient(ws, "HAND_UPDATE", {
            cards: playerHand.cards,
            handSize: playerHand.cards.length,
            currentCardType: room.game.currentCardType
          });
        }
        
      }
        const chatHistory = getRoomChatHistory(room.roomCode);
        chatHistory.forEach(chatMessage => {
            sendToClient(ws, "CHAT_BROADCAST", chatMessage);
        });

        broadcastToOthers(room, ws, "PLAYER_RECONNECTED", {
          playerId: ws.clientId,
          playerName: ws.clientUsername,
          message: `${ws.clientUsername} has reconnected to the game!`
        });

      return true;
    }
  }
  return false;
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
        broadcastToRoom(room, "CHAT_BROADCAST", chatMessage);
    }
}