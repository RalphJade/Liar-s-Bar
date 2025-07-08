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

/**
 * Handles a request from a user to create a new game room.
 * @param ws The WebSocket connection of the user creating the room.
 * @param payload The room details (name, password).
 */
export function handleCreateRoom(
  ws: CustomWebSocket,
  payload: { roomName: string; password?: string }
): void {
  if (ws.currentRoomCode) {
    log(
      `User ${ws.clientUsername} tried to create a room but is already in another one.`,
      { ws }
    );
    sendToClient(ws, "ERROR", {
      message:
        "You are already in a room. Please leave your current room to create a new one.",
    });
    return;
  }

  const { roomName, password } = payload;
  const roomCode = generateCodeWithFaker();
  
  // Create the base room object
  const newRoom: Room = {
    roomName,
    roomCode,
    ownerId: ws.clientId,
    status: "waiting",
    players: new Map(),
    spectators: new Map(),
    password: password || undefined,
    choices: new Map(), // Maintained for compatibility, not used in card game
  };

  // Create the full room object with the game state
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

  // Add the creator as the first player
  roomWithGame.players.set(ws.clientId, {
    username: ws.clientUsername,
    ws,
  });

  // Add the room to the global game state
  addRoom(roomCode, roomWithGame);

  // Assign the room code to the player's WebSocket connection
  ws.currentRoomCode = roomCode;

  log(`Room ${roomCode} created by ${ws.clientUsername}.`, { ws });

  // *** CORRECTION START ***
  // 1. Send a direct JOINED_ROOM message to the creator to trigger navigation.
  sendToClient(ws, "JOINED_ROOM", {
    roomCode: roomWithGame.roomCode,
    asSpectator: false,
    message: `You created and joined the room ${roomWithGame.roomName}.`,
  });

  // 2. Broadcast to the main lobby that a new room is available for OTHERS.
  LobbyManager.broadcast({
    type: "ROOM_CREATED", // This message is for other players in the lobby
    payload: {
      code: roomWithGame.roomCode,
      name: roomWithGame.roomName,
      currentPlayers: roomWithGame.players.size,
      maxPlayers: MAX_PLAYERS,
      hasPassword: !!roomWithGame.password,
      ownerId: roomWithGame.ownerId,
    },
  });
  // *** CORRECTION END ***

  // Send the initial full room state to the creator
  const roomState = getRoomStateForApi(roomWithGame, ws.clientId);
  sendToClient(ws, "ROOM_STATE_UPDATE", roomState);

  // Notify the creator they are waiting for more players
  if (roomWithGame.players.size < MAX_PLAYERS) {
    sendToClient(ws, "WAITING_FOR_PLAYERS", {
      currentPlayers: roomWithGame.players.size,
      maxPlayers: MAX_PLAYERS,
      message: `Waiting for players (${roomWithGame.players.size}/${MAX_PLAYERS})`,
      playersNeeded: MAX_PLAYERS - roomWithGame.players.size,
    });
  }
}

/**
 * Handles a request from a user to join an existing game room.
 * @param ws The WebSocket connection of the user joining.
 * @param payload The join details (room code, password).
 */
export function handlePlayerJoinRoom(
  ws: CustomWebSocket,
  payload: { roomCode: string; password?: string }
): void {
  const { roomCode, password } = payload;

  if (ws.currentRoomCode) {
    log(
      `User ${ws.clientUsername} tried to join room ${roomCode} but is already in another room.`,
      { ws }
    );
    sendToClient(ws, "ERROR", {
      message:
        "You are already in a room. Please leave your current room to join a new one.",
    });
    return;
  }

  const room = getRoom(roomCode.toUpperCase());

  if (!room) {
    log(`Attempt to connect to a non-existent room: ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "Room not found. Please check the room code.",
    });
    return;
  }

  if (room.password && room.password !== password) {
    log(`Incorrect password attempt for room ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "Incorrect password. Please try again.",
    });
    return;
  }

  if (room.status === "playing") {
      log(`Attempt to join a game in progress: ${roomCode}`, { ws });
      sendToClient(ws, "ERROR", {
          message: "This game is already in progress. You can join as a spectator.",
      });
      // Logic to add as spectator can be implemented here if desired.
      return;
  }

  if (room.players.size >= MAX_PLAYERS) {
    log(`Attempt to connect to a full room: ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "This room is full. You will be added as a spectator.",
    });
    // Add as a spectator
    room.spectators.set(ws.clientId, { username: ws.clientUsername, ws });
    ws.currentRoomCode = roomCode.toUpperCase();

    sendToClient(ws, "JOINED_ROOM", {
      roomCode: room.roomCode,
      asSpectator: true,
      message: "You have joined as a spectator.",
    });

    broadcastRoomState(room);
    return;
  }

  // Add the player to the room
  room.players.set(ws.clientId, {
    username: ws.clientUsername,
    ws,
  });
  ws.currentRoomCode = roomCode.toUpperCase();

  log(
    `Player ${ws.clientUsername} joined room ${roomCode} (${room.players.size}/${MAX_PLAYERS}).`,
    { ws }
  );

  // Send confirmation to the player who just joined
  sendToClient(ws, "JOINED_ROOM", {
    roomCode: room.roomCode,
    asSpectator: false,
    message: `You have joined room ${room.roomName}.`,
  });

  // Broadcast the updated room state to everyone in the room
  broadcastRoomState(room);

  // Check if the room is now full and the game can start
  if (room.players.size === MAX_PLAYERS) {
    log(`Room ${room.roomCode} is full. Starting game.`);
    startCardGame(room);
  } else {
    // Notify everyone in the room about the updated player count
    broadcastToRoom(room, "WAITING_FOR_PLAYERS", {
      currentPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS,
      message: `Waiting for players (${room.players.size}/${MAX_PLAYERS})`,
      playersNeeded: MAX_PLAYERS - room.players.size,
    });
  }

  // Update the main lobby with the new player count for this room
  LobbyManager.broadcast({
    type: "ROOM_LIST_UPDATE", // A new message type for updating a single room in the lobby list
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
    sendToClient(ws, "ERROR", {
      message: "You must be in a room to signal readiness.",
    });
    return;
  }

  const room = getRoom(roomCode);
  if (!room) return;

  const roomHands = getRoomHands(room.roomCode);
  if (!roomHands) return;

  const playerHand = roomHands?.get(ws.clientId);
  if (!playerHand) return;

  playerHand.isReady = true;

  // Check if all players are ready
  const allReady = Array.from(room.players.keys()).every((playerId) => {
    const hand = roomHands?.get(playerId);
    return hand?.isReady === true;
  });

  if (allReady) {
    startCardGame(room);
  } else {
    const readyCount = Array.from(room.players.keys()).filter((playerId) => {
      const hand = roomHands?.get(playerId);
      return hand?.isReady === true;
    }).length;

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

  // Notify all participants that the room is closing
  broadcastToRoom(room, "ROOM_CLOSED", {
    code: roomCode,
    name: room.roomName,
  });

  // Remove the room from the global state
  removeRoom(roomCode);
  
  // Update the main lobby
  LobbyManager.broadcast({
    type: "ROOM_REMOVED", // New message type to signal removal from lobby list
    payload: { code: roomCode }
  });
}

/**
 * Handles a player leaving a room. If the owner leaves, the room is closed.
 * @param ws The WebSocket of the player leaving.
 */
export function handleLeaveRoom(ws: CustomWebSocket): void {
  const roomCode = ws.currentRoomCode;
  if (!roomCode) {
    sendToClient(ws, "ERROR", { message: "You are not in a room." });
    return;
  }

  const room = getRoom(roomCode);
  if (!room) return;

  if (room.ownerId === ws.clientId) {
    // If the owner leaves, close the entire room
    handleCloseRoom(ws);
  } else {
    // If a regular player leaves
    log(`Player ${ws.clientUsername} left room ${room.roomCode}.`, { ws });

    room.players.delete(ws.clientId);
    room.spectators.delete(ws.clientId);
    ws.currentRoomCode = "";

    if (room.players.size === 0 && room.spectators.size === 0) {
      removeRoom(roomCode);
       LobbyManager.broadcast({
        type: "ROOM_REMOVED",
        payload: { code: roomCode }
      });
    } else {
      // If the game was in progress, we might need to advance the turn
      if (room.status === 'playing') {
        advanceTurnAfterInterruption(room);
      }
      
      broadcastRoomState(room);
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
export function handlePlayerDisconnect(ws: CustomWebSocket): void {
  const roomCode = ws.currentRoomCode;
  if (!roomCode) {
    // If not in a room, the lobby manager handles the disconnect
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
    broadcastRoomState(room);
    return;
  }
  
  const participant = room.players.get(ws.clientId);
  if (participant) {
    log(`Player ${ws.clientUsername} disconnected from room ${room.roomCode}.`, { ws });
    participant.ws = null; // Mark as disconnected but keep their data
    
    // If it was the disconnected player's turn, handle it
    const playerIds = Array.from(room.players.keys());
    if (playerIds[room.game.currentPlayerIndex] === ws.clientId && room.status === 'playing') {
      advanceTurnAfterInterruption(room);
    }
    
    broadcastToOthers(room, ws, "PLAYER_DISCONNECTED", {
        playerId: ws.clientId,
        playerName: ws.clientUsername,
        message: `${ws.clientUsername} has disconnected.`,
    });

    broadcastRoomState(room);
  } else {
    // If they were not a player or spectator in the room, handle as lobby disconnect
    LobbyManager.handleDisconnect(ws);
  }
}

/**
 * Broadcasts the current, complete state of the room to all participants.
 * Each player receives a personalized state (e.g., with their own cards).
 * @param room The room whose state is to be broadcast.
 */
export function broadcastRoomState(room: Room & { game: CardGame }): void {
  log(
    `Broadcasting state of room ${room.roomCode} to all participants.`
  );
  const allParticipants = [
    ...room.players.values(),
    ...room.spectators.values(),
  ];

  allParticipants.forEach((participant) => {
    // Only send to connected clients
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      const personalRoomState = getRoomStateForApi(
        room,
        participant.ws.clientId
      );
      sendToClient(participant.ws, "ROOM_STATE_UPDATE", personalRoomState);
    }
  });
}

/**
 * Constructs a serializable version of the room state for API responses.
 * It tailors the response based on the user requesting it (e.g., hiding other players' cards).
 * @param room The full room object.
 * @param currentUserId The ID of the user requesting the state.
 * @returns {RoomStateForApi} A safe, serializable version of the room state.
 */
export function getRoomStateForApi(
  room: Room & { game: CardGame },
  currentUserId: string
): RoomStateForApi {
  const roomHands = getRoomHands(room.roomCode);
  const currentPlayerHand = roomHands?.get(currentUserId);

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
      currentPlayerId: Array.from(room.players.keys())[
        room.game.currentPlayerIndex
      ] || null,
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