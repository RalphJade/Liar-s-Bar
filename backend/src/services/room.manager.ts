import {
  getRoom,
  addRoom,
  getAllRooms,
  removeRoom,
  getRoomHands,
} from "./gameState";
import { log } from "../utils/logger";
import {
  sendToClient,
  broadcastToRoom,
  broadcastToOthers,
} from "../utils/websocket.util";
import { Room, RoomStateForApi, CustomWebSocket, CardGame } from "../models/types.model";
import { generateCodeWithFaker } from "../utils/room.util";
import { startCardGame, advanceTurnAfterInterruption } from "./game-logic";
import { MAX_PLAYERS, TURN_TIME_LIMIT } from "../config/game.config";
import * as LobbyManager from "./lobby.manager";
import { pool } from '../database';
import { WebSocket } from 'ws';

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
  }

  LobbyManager.broadcast({
    type: "ROOM_LIST_UPDATE",
    payload: {
      code: room.roomCode,
      name: room.roomName,
      currentPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS,
      hasPassword: !!room.password,
    }
  });
}

/**
 * Handles chat messages sent within a room.
 * @param ws The sender's WebSocket.
 * @param payload The message content.
 */
export function handleRoomChatMessage(ws: CustomWebSocket, payload: { message: string }): void {
    const roomCode = ws.currentRoomCode;
    if (!roomCode) return;
  
    const room = getRoom(roomCode);
    if (!room) return;
  
    const message = payload.message.trim();
    if (message) {
      log(`Chat in room ${roomCode} from ${ws.clientUsername}: ${message}`);
      broadcastToRoom(room, "CHAT_BROADCAST", {
        authorId: ws.clientId,
        authorName: ws.clientUsername,
        message: message,
        timestamp: new Date().toISOString(),
      });
    }
}


/**
 * Sends the list of waiting rooms to a specific client.
 * @param ws The client's WebSocket connection.
 */
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
    broadcastToRoom(room, "PLAYERS_READY_UPDATE", {
      readyCount,
      totalPlayers: room.players.size,
      message: `${readyCount}/${room.players.size} players ready`,
    });
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

  if (room.ownerId === ws.clientId) {
    handleCloseRoom(ws);
  } else {
    log(`Player ${ws.clientUsername} left room ${room.roomCode}.`, { ws });
    room.players.delete(ws.clientId);
    room.spectators.delete(ws.clientId);
    ws.currentRoomCode = "";

    if (room.players.size === 0 && room.spectators.size === 0) {
      removeRoom(roomCode);
      LobbyManager.broadcast({ type: "ROOM_REMOVED", payload: { code: roomCode } });
    } else {
      if (room.status === 'playing') {
        advanceTurnAfterInterruption(room);
      }
      
      await broadcastRoomState(room);
      broadcastToRoom(room, "PLAYER_LEFT", {
        playerId: ws.clientId,
        playerName: ws.clientUsername,
        message: `${ws.clientUsername} has left the room.`,
        currentPlayers: room.players.size,
      });

      LobbyManager.broadcast({
        type: "ROOM_LIST_UPDATE",
        payload: {
          code: room.roomCode,
          name: room.roomName,
          currentPlayers: room.players.size,
          maxPlayers: MAX_PLAYERS,
          hasPassword: !!room.password,
        }
      });
    }
  }
}

/**
 * Handles a player disconnecting from the server (e.g., closing the browser).
 * @param ws The WebSocket connection that was closed.
 */
export async function handlePlayerDisconnect(ws: CustomWebSocket): Promise<void> {
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

  if (room.spectators.has(ws.clientId)) {
    log(`Spectator ${ws.clientUsername} disconnected from room ${room.roomCode}.`, { ws });
    room.spectators.delete(ws.clientId);
    await broadcastRoomState(room);
    return;
  }
  
  const participant = room.players.get(ws.clientId);
  if (participant) {
    log(`Player ${ws.clientUsername} disconnected from room ${room.roomCode}.`, { ws });
    participant.ws = null;
    
    const playerIds = Array.from(room.players.keys());
    if (playerIds[room.game.currentPlayerIndex] === ws.clientId && room.status === 'playing') {
      advanceTurnAfterInterruption(room);
    }
    
    broadcastToOthers(room, ws, "PLAYER_DISCONNECTED", {
        playerId: ws.clientId,
        playerName: ws.clientUsername,
        message: `${ws.clientUsername} has disconnected.`,
    });

    await broadcastRoomState(room);
  } else {
    LobbyManager.handleDisconnect(ws);
  }
}

/**
 * Broadcasts the current, complete state of the room to all participants.
 * @param room The room whose state is to be broadcast.
 */
export async function broadcastRoomState(room: Room & { game: CardGame }): Promise<void> {
  log(`Broadcasting state of room ${room.roomCode} to all participants.`);
  
  // Use Promise.all to fetch all data and send messages concurrently
  await Promise.all(
    Array.from(room.players.values()).map(async (participant) => {
      if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
        const personalRoomState = await getRoomStateForApi(room, participant.ws.clientId);
        sendToClient(participant.ws, "ROOM_STATE_UPDATE", personalRoomState);
      }
    })
  );
}

/**
 * Constructs a serializable version of the room state for API responses.
 * @param room The full room object.
 * @param currentUserId The ID of the user requesting the state.
 * @returns {Promise<RoomStateForApi>} A safe, serializable version of the room state.
 */
export async function getRoomStateForApi(
  room: Room & { game: CardGame },
  currentUserId: string
): Promise<RoomStateForApi> {
  const roomHands = getRoomHands(room.roomCode);
  const currentPlayerHand = roomHands?.get(currentUserId);

  const playerIds = Array.from(room.players.keys());
  const userAvatars = new Map<string, string | null>();

  if (playerIds.length > 0) {
      const result = await pool.query<{ id: string, avatar_url: string | null }>(
          'SELECT id, avatar_url FROM users WHERE id = ANY($1::uuid[])',
          [playerIds]
      );
      result.rows.forEach(row => userAvatars.set(row.id, row.avatar_url));
  }
  
  return {
    roomCode: room.roomCode,
    ownerId: room.ownerId,
    players: Array.from(room.players.entries()).map(([id, p]) => {
      const hand = roomHands?.get(id);
      return {
        id,
        username: p.username,
        isOnline: p.ws !== null,
        handSize: hand?.cards.length || 0,
        isReady: hand?.isReady || false,
        hasPlayedThisTurn: hand?.hasPlayedThisTurn || false,
        score: hand?.score || 0,
        riskLevel: hand?.riskLevel || 0,
        isEliminated: hand?.isEliminated || false,
        avatar_url: userAvatars.get(id) || null,
      };
    }),
    spectators: Array.from(room.spectators.entries()).map(([id, s]) => ({
      id,
      username: s.username,
    })),
    status: room.status,
    myChoice: room.choices.get(currentUserId) || null,
    game: {
      phase: room.game.phase,
      currentPlayerIndex: room.game.currentPlayerIndex,
      currentPlayerId: playerIds[room.game.currentPlayerIndex] || null,
      currentCardType: room.game.currentCardType,
      roundNumber: room.game.roundNumber,
      direction: room.game.direction,
      playedCardsCount: room.game.playedCards.length,
      deckSize: room.game.deck.length,
      lastPlayerId: room.game.lastPlayerId,
    },
    myCards: currentPlayerHand?.cards || [],
    myHandSize: currentPlayerHand?.cards.length || 0,
  };
}