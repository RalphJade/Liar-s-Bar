import { Server as WebSocketServer } from "ws";
import { ClientMessage, CustomWebSocket } from "../models/types.model";
import { log } from "../utils/logger";
import { sendToClient } from "../utils/websocket.util";

import * as LobbyManager from "./lobby.manager"
import * as RoomManager from "./room.manager"
import * as GameLogic from "./game-logic"

export function initializeGameService(wss: WebSocketServer): void {
  wss.on("connection", (ws: CustomWebSocket, request: any) => {
    log(`Nova conexão WebSocket.`, { ws });

    userConnections.set(ws.clientId, ws);

      handleWaitingRooms(ws);


    ws.on("message", async (message) => {
      try {
        const data: ClientMessage = JSON.parse(message.toString());
        log("Mensagem recebida.", { ws, data });
        handleClientMessage(ws, data);
      } catch (error: any) {
        log("Erro ao parsear mensagem JSON.", { ws, data: { error: error.message, originalMessage: message.toString() } });
      }
    });

    // 3. O listener de 'close' chama nosso handler de desconexão do lobby
    ws.on("close", () => {
      LobbyManager.handleDisconnect(ws);
    });

    ws.on("error", (error) => {
      log("Erro no WebSocket.", { ws, data: { error: error.message } });
    });
  });
}

function handleClientMessage(ws: CustomWebSocket, data: ClientMessage): void {
  // Validação básica do formato da mensagem
  if (!data.type || !data.payload) {
    sendToClient(ws, "ERROR", { message: "Formato de mensagem inválido." });
    return;
  }

  // O switch direciona a ação com base no tipo da mensagem
  switch (data.type) {
    case "CHAT_MESSAGE":
      LobbyManager.handleChatMessage(ws, data.payload);
      break;
    case "LIST_ROOMS":
      RoomManager.handleWaitingRooms(ws);
      break;
    case "CREATE_ROOM":
      RoomManager.handleCreateRoom(ws, data.payload);
      break;
    case "JOIN_ROOM":
      RoomManager.handlePlayerJoinRoom(ws, data.payload);
      break;
    case "PLAY_CARD":
      GameLogic.handlePlayCard(ws, data.payload);
      break;
    case "CLOSE_ROOM":
      RoomManager.handleCloseRoom(ws);
      break;
    case "READY_FOR_NEXT_GAME":
      RoomManager.handleReadyForNextGame(ws);
      break;
    case "CHALLENGE_PLAYER":
      GameLogic.handleChallengePlayer(ws, data.payload);
      break;
    case "LEAVE_ROOM":
      RoomManager.handlePlayerDisconnect(ws);
      break;
  }
}

// async function addPlayerToRoom(ws: CustomWebSocket, room: Room): Promise<void> {
//   const { clientId, clientUsername } = ws;
  
//   if (isUserInAnyRoom(clientId)) {
//     log(`Usuário ${clientUsername} tentou entrar na sala ${room.roomCode} mas já está em outra.`, { ws });
//     sendToClient(ws, "ERROR", { 
//       message: "Você já está em outra sala. Saia da sala atual para poder entrar em uma nova." 
//     });
//     ws.close();
//     return;
//   }

//   if (!roomGlobal.has(room.roomCode)) {
//     roomGlobal.set(room.roomCode, {
//       ...room,
//       players: new Map(),
//       spectators: new Map(),
//       game: {
//         deck: [],
//         currentPlayerIndex: 0,
//         direction: 1,
//         phase: 'waiting',
//         roundNumber: 0,
//         turnTimeLimit: TURN_TIME_LIMIT,
//         turnTimer: null,
//         currentCardType: null,
//         playedCards: [],
//       },
//     });
//   }

//   const localRoom = roomGlobal.get(room.roomCode)!;
//   let participant = localRoom.players.get(clientId) || localRoom.spectators.get(clientId);
  
//   if (participant) {
//     // Reconexão
//     participant.ws = ws;
//     log(`Participante ${clientUsername} reconectado à sala ${room.roomCode}.`, { ws });
    
//     if (localRoom.players.has(clientId)) {
//       broadcastToOthers(localRoom, ws, "PLAYER_RECONNECTED", {
//         playerId: clientId,
//         playerName: clientUsername,
//         message: `${clientUsername} reconectou-se!`
//       });
//     }
//   } else {
//     // Nova entrada
//     if (localRoom.players.size < MAX_PLAYERS) {
//       localRoom.players.set(clientId, { username: clientUsername, ws });
//       log(`Jogador ${clientUsername} entrou na sala ${room.roomCode} (${localRoom.players.size}/${MAX_PLAYERS}).`, { ws });
      
//       // Verifica se pode iniciar o jogo
//       if (localRoom.players.size === MAX_PLAYERS) {
//         startCardGame(localRoom);
//       } else {
//         // Notifica que precisa de mais jogadores
//         broadcastToRoom(localRoom, "WAITING_FOR_PLAYERS", {
//           currentPlayers: localRoom.players.size,
//           maxPlayers: MAX_PLAYERS,
//           message: `Aguardando jogadores (${localRoom.players.size}/${MAX_PLAYERS})`,
//           playersNeeded: MAX_PLAYERS - localRoom.players.size
//         });
//       }
//     } else {
//       // Adiciona como espectador
//       localRoom.spectators.set(clientId, { username: clientUsername, ws });
//       log(`Espectador ${clientUsername} entrou na sala ${room.roomCode}.`, { ws });
//     }
//   }
// }

// function attemptPlayerReconnection(ws: CustomWebSocket): boolean {
//   for (const room of roomGlobal.values()) {
//     const participant = room.players.get(ws.clientId) || room.spectators.get(ws.clientId);
    
//     if (participant && !participant.ws) {
//       log(`Reconectando ${ws.clientUsername} à sala ${room.roomCode}.`, { ws });
      
//       participant.ws = ws;
//       ws.currentRoomCode = room.roomCode;
      
//       // Envia estado da sala
//       const roomState = getRoomStateForApi(room, ws.clientId);
//       sendToClient(ws, "ROOM_STATE_UPDATE", roomState);
      
//       // Envia cartas se for jogador
//       if (room.players.has(ws.clientId)) {
//         const roomHands = playerHands.get(room.roomCode);
//         const playerHand = roomHands?.get(ws.clientId);
        
//         if (playerHand) {
//           sendToClient(ws, "HAND_UPDATE", {
//             cards: playerHand.cards,
//             handSize: playerHand.cards.length,
//             currentCardType: room.game.currentCardType
//           });
//         }
        
//         broadcastToOthers(room, ws, "PLAYER_RECONNECTED", {
//           playerId: ws.clientId,
//           playerName: ws.clientUsername,
//           message: `${ws.clientUsername} reconectou-se!`
//         });
//       }
      
//       return true;
//     }
//   }
//   return false;
// }

// function prepareNextGame(room: Room & { game: CardGame }): void {
//   room.game.phase = "waiting";
  
//   // Resetar hands
//   const roomHands = playerHands.get(room.roomCode);
//   if (roomHands) {
//     roomHands.forEach(hand => {
//       hand.isReady = false;
//       hand.hasPlayedThisTurn = false;
//       hand.cards = []; // Limpa cartas para próximo jogo
//     });
//   }

  broadcastToRoom(room, "NEXT_GAME_READY", {
    message: "Pronto para o próximo jogo? Clique em 'Pronto' quando estiver preparado.",
    scores: Array.from(room.players.keys()).map(playerId => ({
      playerId,
      playerName: room.players.get(playerId)?.username || '',
      score: roomHands?.get(playerId)?.score || 0
    }))
  });
}

function isUserInAnyRoom(userId: string): boolean {
  for (const room of roomGlobal.values()) {
    if (room.players.has(userId) || room.spectators.has(userId)) {
      return true;
    }
  }
  return false;
}

function getRoomStateForApi(room: Room & { game: CardGame }, currentUserId: string): RoomStateForApi {
  const roomHands = playerHands.get(room.roomCode);
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

function handlePlayCard(ws: CustomWebSocket, payload: { cardId: string; declaredType?: CardType }): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  const { cardId, declaredType } = payload;
  const roomHands = playerHands.get(room.roomCode);
  const playerHand = roomHands?.get(ws.clientId);

  if (!playerHand) return;

  // Verifica se é a vez do jogador
  const currentPlayerId = Array.from(room.players.keys())[room.game.currentPlayerIndex];
  if (currentPlayerId !== ws.clientId) {
    return sendToClient(ws, "ERROR", { message: "Não é sua vez!" });
  }

  // Verifica se já jogou nesta rodada
  if (playerHand.hasPlayedThisTurn) {
    return sendToClient(ws, "ERROR", { message: "Você já jogou nesta rodada!" });
  }

  // Verifica se a carta existe na mão
  const cardIndex = playerHand.cards.findIndex(card => card.id === cardId);
  if (cardIndex === -1) {
    return sendToClient(ws, "ERROR", { message: "Você não possui esta carta." });
  }

  const card = playerHand.cards[cardIndex];

  // Se é a primeira carta da rodada, define o tipo
  if (room.game.currentCardType === null) {
    if (card.type === 'joker') {
      if (!declaredType || !['king', 'queen', 'ace'].includes(declaredType)) {
        return sendToClient(ws, "ERROR", { 
          message: "Você deve declarar que tipo de carta o coringa representa (king, queen ou ace)." 
        });
      }
      room.game.currentCardType = declaredType;
    } else {
      room.game.currentCardType = card.type;
    }
  }

  // Verifica se a jogada é válida
  if (!canPlayCard(card, room.game.currentCardType)) {
    return sendToClient(ws, "ERROR", { 
      message: `Você deve jogar uma carta do tipo: ${room.game.currentCardType}` 
    });
  }

  // Remove carta da mão
  playerHand.cards.splice(cardIndex, 1);
  playerHand.hasPlayedThisTurn = true;
  
  // Adiciona à pilha de cartas jogadas
  room.game.playedCards.push(card);
  
  // Cancela timer do turno
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }

  const isJoker = card.type === 'joker';
  const displayType = isJoker ? declaredType : card.type;

  log(`Jogador ${ws.clientUsername} jogou carta ${card.type}${isJoker ? ` (declarado como ${declaredType})` : ''}.`, { ws });

  // Envia confirmação para o jogador
  sendToClient(ws, "CARD_PLAYED", {
    card,
    handSize: playerHand.cards.length,
    declaredType: isJoker ? declaredType : undefined,
    currentCardType: room.game.currentCardType
  });

  // Verifica se o jogador ganhou
  if (playerHand.cards.length === 0) {
    handlePlayerWin(room, ws.clientId);
    return;
  }

  // Próximo jogador
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    startPlayerTurn(room, nextPlayerId);
  }
}

function handleChallengePlayer(ws: CustomWebSocket, payload: { targetPlayerId: string }): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  const { targetPlayerId } = payload;
  const challenger = room.players.get(ws.clientId);
  const target = room.players.get(targetPlayerId);

  if (!challenger || !target) {
    return sendToClient(ws, "ERROR", { message: "Jogador não encontrado." });
  }

  // Só pode desafiar se houver cartas jogadas na rodada
  if (room.game.playedCards.length === 0) {
    return sendToClient(ws, "ERROR", { message: "Não há cartas para desafiar." });
  }

  // Lógica do desafio seria implementada aqui
  // Por exemplo, verificar se o jogador jogou a carta certa
  
  broadcastToRoom(room, "PLAYER_CHALLENGED", {
    challengerId: ws.clientId,
    challengerName: challenger.username,
    targetId: targetPlayerId,
    targetName: target.username,
    message: `${challenger.username} desafiou ${target.username}!`
  });
}

function handlePlayerWin(room: Room & { game: CardGame }, winnerId: string): void {
  const winner = room.players.get(winnerId);
  if (!winner) return;

  log(`Jogador ${winner.username} ganhou na sala ${room.roomCode}!`);

  // Cancela timer se existir
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }

  room.game.phase = "finished";
  room.status = "waiting";

  // Atualiza score
  const roomHands = playerHands.get(room.roomCode);
  const winnerHand = roomHands?.get(winnerId);
  if (winnerHand) {
    winnerHand.score++;
  }

  // Notifica todos os jogadores
  broadcastToRoom(room, "GAME_FINISHED", {
    winnerId,
    winnerName: winner.username,
    message: `${winner.username} ganhou!`,
    roundNumber: room.game.roundNumber,
    finalHands: Array.from(room.players.keys()).map(playerId => ({
      playerId,
      playerName: room.players.get(playerId)?.username || '',
      cardsLeft: roomHands?.get(playerId)?.cards.length || 0,
      score: roomHands?.get(playerId)?.score || 0
    }))
  });

  // Prepara para próximo jogo
  setTimeout(() => {
    prepareNextGame(room);
  }, 10000);
}

function handlePlayerDisconnect(ws: CustomWebSocket): void {
  const room = roomGlobal.get(ws.currentRoomCode);
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
    if (currentPlayerId === ws.clientId && room.game.turnTimer) {
      clearTimeout(room.game.turnTimer);
      room.game.turnTimer = null;
      
      // Passa para o próximo jogador
      const nextPlayerId = getNextPlayer(room);
      if (nextPlayerId) {
        startPlayerTurn(room, nextPlayerId);
      }
    }

    broadcastToOthers(room, ws, "PLAYER_DISCONNECTED", {
      playerId: ws.clientId,
      playerName: ws.clientUsername,
      message: `${ws.clientUsername} se desconectou.`,
    });

    broadcastRoomState(room);
  }
}

function handleCloseRoom(ws: CustomWebSocket): void {
  const room = roomGlobal.get(ws.currentRoomCode);
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
  playerHands.delete(room.roomCode);
  roomGlobal.delete(room.roomCode);
}

function handleReadyForNextGame(ws: CustomWebSocket): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  const roomHands = playerHands.get(room.roomCode);
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

function handleCreateRoom(ws: CustomWebSocket, payload: {roomName: string; password?: string }): void {
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
  roomGlobal.set(roomCode, roomWithGame);

  // Atualiza o código da sala na conexão do jogador
  ws.currentRoomCode = roomCode;

  log(`Sala ${roomCode} criada por ${ws.clientUsername}.`, { ws });

  // Envia confirmação para o cliente que criou a sala
  sendToClient(ws, "ROOM_CREATED", {
    roomCode: roomWithGame.roomCode,
    ownerId: roomWithGame.ownerId,
    players: Array.from(roomWithGame.players.entries()).map(([id, p]) => ({
      id,
      username: p.username,
      isOnline: p.ws !== null
    })),
    spectators: Array.from(roomWithGame.spectators.entries()).map(([id, s]) => ({ 
      id, 
      username: s.username 
    })),
    status: roomWithGame.status,
    message: `Sala ${roomCode} criada com sucesso! Aguardando outros jogadores.`,
    maxPlayers: MAX_PLAYERS,
    currentPlayers: roomWithGame.players.size,
    playersNeeded: MAX_PLAYERS - roomWithGame.players.size
  });

    broadcastWaitingRoomsToAll()


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

function handlePlayerJoinRoom(ws: CustomWebSocket, payload: { roomCode: string; password?: string }): void {
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
  const room = roomGlobal.get(roomCode.toUpperCase());
  
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

function broadcastWaitingRoomsToAll(): void {
  const availableRooms = Array.from(roomGlobal.values()).filter(room => room.status === "waiting");
  const roomsData = {
    rooms: availableRooms.map(room => ({
      code: room.roomCode,
      name: room.roomName,
      currentPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS,
      hasPassword: !!room.password
    }))
  };

  // Envia para todos os clientes conectados
  userConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      sendToClient(ws, "WAITING_ROOMS", roomsData);
    }
  });
}

function handleWaitingRooms(ws: CustomWebSocket): void {
  const availableRooms = Array.from(roomGlobal.values()).filter(room => room.status === "waiting");
  sendToClient(ws, "WAITING_ROOMS", {
    rooms: availableRooms.map(room => ({
      code: room.roomCode,
      name: room.roomName,
      currentPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS,
      hasPassword: !!room.password
    }))
  });
}

// Exports
export {
  roomGlobal,
  playerHands,
};