import { Server as WebSocketServer } from "ws";
import { ClientMessage, CustomWebSocket } from "../models/types.model";
import { log } from "../utils/logger";
import { sendToClient } from "../utils/websocket.util";

import * as LobbyManager from "./lobby.manager"
import * as RoomManager from "./room.manager"
import * as GameLogic from "./game-logic"

export function initializeGameService(wss: WebSocketServer): void {
  // O listener de 'connection' agora é o ponto de entrada para TUDO
  wss.on("connection", (ws: CustomWebSocket) => {
    // 1. A primeira coisa a fazer é chamar o handler de conexão do lobby
    LobbyManager.handleNewConnection(ws);
    // Em seguida, enviamos a lista de salas disponíveis
    RoomManager.handleWaitingRooms(ws);

    // 2. O listener de mensagem chama nosso roteador de mensagens unificado
    ws.on("message", (message) => {
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
      RoomManager.handleLeaveRoom(ws);
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

//   broadcastToRoom(room, "NEXT_GAME_READY", {
//     message: "Pronto para o próximo jogo? Clique em 'Pronto' quando estiver preparado.",
//     scores: Array.from(room.players.keys()).map(playerId => ({
//       playerId,
//       playerName: room.players.get(playerId)?.username || '',
//       score: roomHands?.get(playerId)?.score || 0
//     }))
//   });
// }

// function isUserInAnyRoom(userId: string): boolean {
//   for (const room of roomGlobal.values()) {
//     if (room.players.has(userId) || room.spectators.has(userId)) {
//       return true;
//     }
//   }
//   return false;
// }