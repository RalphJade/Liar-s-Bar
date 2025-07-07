import { getRoom, addRoom, getAllRooms, removeRoom, getRoomHands } from './gameState';
import { log } from "../utils/logger";
import { sendToClient, broadcastToRoom, broadcastToOthers } from "../utils/websocket.util";
import { Room, RoomStateForApi,CustomWebSocket } from "../models/types.model";
import { CardGame } from "./cards.service";
import { generateCodeWithFaker } from "../utils/room.util";
import { startCardGame, advanceTurnAfterInterruption } from "./game-logic";
import { MAX_PLAYERS, TURN_TIME_LIMIT } from '../config/game.config';
import * as LobbyManager from './lobby.manager';

export function handleCreateRoom(ws: CustomWebSocket, payload: {roomName: string; password?: string }): void {
  if (ws.currentRoomCode) {
    log(`Usuário ${ws.clientUsername} tentou criar uma sala, mas já está em outra sala.`, { ws }); 
    sendToClient(ws, "ERROR", { 
      message: "Você já está em outra sala. Saia da sala atual para criar uma nova." 
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

  // Cria a sala completa com o jogo
  const roomWithGame: Room & { game: CardGame } = {
    ...newRoom,
    game: {
      deck: [],
      currentPlayerIndex: 0,
      direction: 1,
      phase: 'waiting',
      roundNumber: 0,
      turnTimeLimit: TURN_TIME_LIMIT,
      turnTimer: null,
      currentCardType: null,
      playedCards: [],
    },
  };

  // Adiciona o jogador criador à sala
  roomWithGame.players.set(ws.clientId, { 
    username: ws.clientUsername, 
    ws 
  });

  // Adiciona a sala ao array global de salas
  addRoom(roomCode, roomWithGame);

  // Atualiza o código da sala na conexão do jogador
  ws.currentRoomCode = roomCode;

  log(`Sala ${roomCode} criada por ${ws.clientUsername}.`, { ws });

  // Envia confirmação para o cliente que criou a sala
LobbyManager.broadcast({
  type: "ROOM_CREATED",
  payload: {
      // Dados da sala no mesmo formato do WAITING_ROOMS
      code: roomWithGame.roomCode,
      name: roomWithGame.roomName,
      currentPlayers: roomWithGame.players.size,
      maxPlayers: MAX_PLAYERS,
      hasPassword: !!roomWithGame.password,
      ownerId: roomWithGame.ownerId, // Para identificar o criador
    },
});

  // Envia o estado inicial da sala
  const roomState = getRoomStateForApi(roomWithGame, ws.clientId);
  sendToClient(ws, "ROOM_STATE_UPDATE", roomState);

  // Notifica que precisa de mais jogadores
  if (roomWithGame.players.size < MAX_PLAYERS) {
    sendToClient(ws, "WAITING_FOR_PLAYERS", {
      currentPlayers: roomWithGame.players.size,
      maxPlayers: MAX_PLAYERS,
      message: `Aguardando jogadores (${roomWithGame.players.size}/${MAX_PLAYERS})`,
      playersNeeded: MAX_PLAYERS - roomWithGame.players.size
    });
  }
}

export function handlePlayerJoinRoom(ws: CustomWebSocket, payload: { roomCode: string; password?: string }): void {
  const { roomCode, password } = payload;
  
  // Verifica se o jogador já está em uma sala
  if (ws.currentRoomCode) {
    log(`Usuário ${ws.clientUsername} tentou entrar na sala ${roomCode}, mas já está em outra sala.`, { ws });
    sendToClient(ws, "ERROR", { 
      message: "Você já está em outra sala. Saia da sala atual para entrar em uma nova." 
    });
    return;
  }
  
  // Busca a sala no array global
  const room = getRoom(roomCode.toUpperCase());
  
  if (!room) {
    log(`Tentativa de conexão com sala inexistente: ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "Sala não encontrada. Verifique o código da sala.",
    });
    return;
  }
  
  // Verifica se a sala tem senha
  if (room.password && room.password !== password) {
    log(`Tentativa de conexão com senha incorreta na sala ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "Senha incorreta. Tente novamente.",
    });
    return;
  }
  
  // Verifica se a sala está cheia
  if (room.players.size >= MAX_PLAYERS) {
    log(`Tentativa de conexão com sala lotada: ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "Sala está cheia. Você será adicionado como espectador.",
    });
    // Adiciona como espectador
    room.spectators.set(ws.clientId, { username: ws.clientUsername, ws });
    ws.currentRoomCode = roomCode.toUpperCase();
    
    sendToClient(ws, "JOINED_ROOM", { 
      roomCode: room.roomCode,
      asSpectator: true,
      message: "Você entrou como espectador."
    });
    
    broadcastRoomState(room);
    return;
  }
  
  // Adiciona o jogador à sala
  room.players.set(ws.clientId, { 
    username: ws.clientUsername, 
    ws 
  });
  
  // Atualiza o código da sala na conexão do jogador
  ws.currentRoomCode = roomCode.toUpperCase();
  
  log(`Jogador ${ws.clientUsername} entrou na sala ${roomCode} (${room.players.size}/${MAX_PLAYERS}).`, { ws });
  
  // Envia confirmação para o jogador que entrou
  sendToClient(ws, "JOINED_ROOM", { 
    roomCode: room.roomCode,
    asSpectator: false,
    message: `Você entrou na sala ${room.roomCode}.`
  });
  
  // Verifica se pode iniciar o jogo
  if (room.players.size === MAX_PLAYERS) {
    log(`Sala ${room.roomCode} está cheia. Iniciando jogo.`);
    startCardGame(room);
  } else {
    // Notifica que precisa de mais jogadores
    broadcastToRoom(room, "WAITING_FOR_PLAYERS", {
      currentPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS,
      message: `Aguardando jogadores (${room.players.size}/${MAX_PLAYERS})`,
      playersNeeded: MAX_PLAYERS - room.players.size
    });
  }
  
  // Envia o estado atual da sala
  broadcastRoomState(room);
}

export function handleWaitingRooms(ws: CustomWebSocket): void {
  const allRooms = getAllRooms(); 
  const availableRooms = allRooms.filter(room => room.status === "waiting");
  sendToClient(ws, "WAITING_ROOMS", {
    rooms: availableRooms.map(room => ({
      code: room.roomCode,
      name: room.roomName,
      currentPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS,
      hasPassword: !!room.password,
    }))
  });
}

export function handleReadyForNextGame(ws: CustomWebSocket): void {
  const roomCode = ws.currentRoomCode;
  if (!roomCode) {
    sendToClient(ws, "ERROR", { message: "You must be in a room to challenge a player." });
    return;
  }

  const room = getRoom(roomCode);
  if (!room) return;

  const roomHands = getRoomHands(room.roomCode);
  if (!roomHands) return;
  
  const playerHand = roomHands?.get(ws.clientId);
  if (!playerHand) return;

  playerHand.isReady = true;
  
  // Verifica se todos estão prontos
  const allReady = Array.from(room.players.keys()).every(playerId => {
    const hand = roomHands?.get(playerId);
    return hand?.isReady === true;
  });

  if (allReady) {
    startCardGame(room);
  } else {
    const readyCount = Array.from(room.players.keys()).filter(playerId => {
      const hand = roomHands?.get(playerId);
      return hand?.isReady === true;
    }).length;

    broadcastToRoom(room, "PLAYERS_READY_UPDATE", {
      readyCount,
      totalPlayers: room.players.size,
      message: `${readyCount}/${room.players.size} jogadores prontos`
    });
  }
}

export function handleCloseRoom(ws: CustomWebSocket): void {
  const roomCode = ws.currentRoomCode;
  if (!roomCode) {
    sendToClient(ws, "ERROR", { message: "You must be in a room to challenge a player." });
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
    sendToClient(ws, "ERROR", { message: "You must be in a room to challenge a player." });
    return;
  }

  const room = getRoom(roomCode);
  if (!room) return;

  if (room.spectators.has(ws.clientId)) {
    log(`Espectador ${ws.clientUsername} saiu da sala ${room.roomCode}.`, { ws });
    room.spectators.delete(ws.clientId);
    broadcastRoomState(room);
    return;
  }

  const participant = room.players.get(ws.clientId);
  if (participant) {
    participant.ws = null;
    log(`Jogador ${ws.clientUsername} desconectou da sala ${room.roomCode}.`, { ws });

    // Cancela timer se era a vez do jogador desconectado
    const currentPlayerId = Array.from(room.players.keys())[room.game.currentPlayerIndex];
    if (currentPlayerId === ws.clientId && room.status === 'playing') {
      // ...nós notificamos o GameLogic para lidar com isso.
      advanceTurnAfterInterruption(room);
    }


    broadcastToOthers(room, ws, "PLAYER_DISCONNECTED", {
      playerId: ws.clientId,
      playerName: ws.clientUsername,
      message: `${ws.clientUsername} se desconectou.`,
    });

    broadcastRoomState(room);
  }
}

export function broadcastRoomState(room: Room & { game: CardGame }): void {
  log(`Transmitindo estado da sala ${room.roomCode} para todos os participantes.`);
  const allParticipants = [...room.players.values(), ...room.spectators.values()];

  allParticipants.forEach((participant) => {
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      const personalRoomState = getRoomStateForApi(room, participant.ws.clientId);
      sendToClient(participant.ws, "ROOM_STATE_UPDATE", personalRoomState);
    }
  });
}

export function getRoomStateForApi(room: Room & { game: CardGame }, currentUserId: string): RoomStateForApi {
  const roomHands = getRoomHands(room.roomCode);
  const currentPlayerHand = roomHands?.get(currentUserId);
  
  return {
    roomCode: room.roomCode,
    ownerId: room.ownerId,
    players: Array.from(room.players.entries()).map(([id, p]) => ({
      id,
      username: p.username,
      isOnline: p.ws !== null,
      handSize: roomHands?.get(id)?.cards.length || 0,
      isReady: roomHands?.get(id)?.isReady || false,
      hasPlayedThisTurn: roomHands?.get(id)?.hasPlayedThisTurn || false,
      score: roomHands?.get(id)?.score || 0,
    })),
    spectators: Array.from(room.spectators.entries()).map(([id, s]) => ({ 
      id, 
      username: s.username 
    })),
    status: room.status,
    game: {
      phase: room.game.phase,
      currentPlayerIndex: room.game.currentPlayerIndex,
      currentPlayerId: Array.from(room.players.keys())[room.game.currentPlayerIndex],
      currentCardType: room.game.currentCardType,
      roundNumber: room.game.roundNumber,
      direction: room.game.direction,
      playedCardsCount: room.game.playedCards.length,
      deckSize: room.game.deck.length,
    },
    myCards: currentPlayerHand?.cards || [],
    myHandSize: currentPlayerHand?.cards.length || 0,
    myChoice: room.choices.get(currentUserId) || null,
  };
}