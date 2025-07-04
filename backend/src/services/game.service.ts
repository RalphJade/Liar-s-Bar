import { WebSocket, Server as WebSocketServer } from "ws";
import {
  Room,
  Participant,
  RoomStateForApi,
  ClientMessage,
  ServerMessage,
  Choice,
} from "../models/types.model";
import { enterRoom } from "./lobby.service";
import { EnterRoomInput } from "../models/lobby.model";
import { log } from "../utils/logger";

export interface CustomWebSocket extends WebSocket {
  clientId: string;
  clientUsername: string;
  currentRoomCode: string;
}

const roomGlobal = new Map<string, Room>();
const userConnections = new Map<string, CustomWebSocket>();

export function sendToClient<T extends ServerMessage["type"]>(
  ws: CustomWebSocket,
  type: T,
  payload: Extract<ServerMessage, { type: T }>["payload"]
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    console.log("Tentativa de envio para um WebSocket fechado.", {
      ws,
      data: { type, payload },
    });
    return;
  }
  const message = { type, payload };
  ws.send(JSON.stringify(message));
  console.log(`Mensagem enviada para o cliente.`, { ws, data: message });
}

export async function handlePlayerConnect(
  ws: CustomWebSocket,
  input: EnterRoomInput
): Promise<void> {
  const { roomCode, password } = input;

  const room = await enterRoom({ roomCode, password });

  if (!room) {
    console.log(`Tentativa de conexão com sala inexistente: ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "Sala não encontrada ou já foi fechada.",
    });
    ws.close();
    return;
  }
}

function broadcastRoomState(room: Room): void {
  log(`Transmitindo estado da sala ${room.roomCode} para todos os participantes.`);
  const allParticipants = [...room.players.values(), ...room.spectators.values()];

  allParticipants.forEach((participant) => {
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      const personalRoomState = getRoomStateForApi(room, participant.ws.clientId);
      sendToClient(participant.ws, "ROOM_STATE_UPDATE", personalRoomState);
    }
  });
}

export function initializeGameService(wss: WebSocketServer): void {
  wss.on("connection", (ws: CustomWebSocket, request: any, roomCode: string) => {
    log(`Nova conexão WebSocket para a sala ${roomCode}.`, { ws });

    userConnections.set(ws.clientId, ws);
    ws.currentRoomCode = roomCode.toUpperCase();

    // Aguarda a primeira mensagem do cliente para tentar entrar na sala (com senha, se necessário)
    let joined = false;

    ws.on("message", async (message) => {
      try {
        const data: ClientMessage = JSON.parse(message.toString());
        log("Mensagem recebida.", { ws, data });

        // Handshake inicial: espera mensagem do tipo ENTER_ROOM
        if (!joined && data.type === "ENTER_ROOM") {
          const { password = "" } = (data.payload as { password?: string }) || {};
          // Valida entrada na sala usando a lógica do lobby
          const room = await enterRoom({ roomCode: ws.currentRoomCode, password });
          if (!room) {
            sendToClient(ws, "ERROR", { message: "Sala não encontrada ou já foi fechada." });
            ws.close();
            return;
          }
          roomGlobal.set(room.code, room)
          // Aqui você pode adicionar lógica para adicionar o usuário como player/espectador
          joined = true;
          sendToClient(ws, "JOINED_ROOM", { roomCode: ws.currentRoomCode });
          // Chame aqui a função para broadcast do estado da sala, se desejar
          return;
        }

        if (!joined) {
          sendToClient(ws, "ERROR", { message: "Você precisa entrar na sala primeiro (ENTER_ROOM)." });
          return;
        }

        // Após handshake, processa as demais mensagens normalmente
        handleClientMessage(ws, data);
      } catch (error: any) {
        log("Erro ao parsear mensagem JSON.", { ws, data: { error: error.message, originalMessage: message.toString() } });
      }
    });

    ws.on("close", () => {
      log("Cliente desconectado.", { ws });
      userConnections.delete(ws.clientId);
      handlePlayerDisconnect(ws);
      // Opcional: Notificar os outros participantes sobre a desconexão
    });

    ws.on("error", (error) => {
      log("Erro no WebSocket.", { ws, data: { error: error.message } });
    });
  });
}

function handleClientMessage(ws: CustomWebSocket, data: ClientMessage): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) {
    return sendToClient(ws, "ERROR", { message: "Você não está em uma sala ativa." });
  }

  const isPlayer = room.players.has(ws.clientId);
  if (!isPlayer && !room.spectators.has(ws.clientId)) {
    return sendToClient(ws, "ERROR", { message: "Você não é um participante desta sala." });
  }

  switch (data.type) {
    case "MAKE_CHOICE":
      if (isPlayer) handleMakeChoice(ws, data.payload);
      else sendToClient(ws, "ERROR", { message: "Espectadores não podem fazer jogadas." });
      break;
    case "CLOSE_ROOM":
      if (isPlayer && room.ownerId === ws.clientId) handleCloseRoom(ws);
      else sendToClient(ws, "ERROR", { message: "Apenas o dono da sala pode fechá-la." });
      break;
  }
}

function isUserInAnyRoom(userId: string): boolean {
  for (const room of roomGlobal.values()) {
    if (room.players.has(userId) || room.spectators.has(userId)) {
      return true;
    }
  }
  return false;
}

function createRoomForApi(userId: string, username: string): RoomStateForApi {
  // Replace the old check with this one
  if (isUserInAnyRoom(userId)) {
    throw new Error("Você já está em uma sala.");
  }
  const userWs = userConnections.get(userId);

  const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  const room: Room = {
    roomCode,
    players: new Map(),
    spectators: new Map(),
    ownerId: userId,
    status: "waiting",
    choices: new Map(),
  };

  room.players.set(userId, { username, ws: null });
  if (userWs) {
    userWs.currentRoomCode = roomCode;
  }

  roomGlobal.set(roomCode, room);
  log(`Sala ${roomCode} criada por ${username} via API.`);
  return getRoomStateForApi(room, userId);
}


function getRoomStateForApi(room: Room, currentUserId: string | null = null): RoomStateForApi {
  const myChoice = currentUserId ? room.choices.get(currentUserId) || null : null;

  return {
    roomCode: room.roomCode,
    ownerId: room.ownerId,
    // Changed: Populate the isOnline flag based on the WebSocket connection status
    players: Array.from(room.players.entries()).map(([id, p]) => ({
      id,
      username: p.username,
      isOnline: p.ws !== null,
    })),
    spectators: Array.from(room.spectators.entries()).map(([id, s]) => ({ id, username: s.username })),
    status: room.status,
    myChoice,
  };
}

function handleMakeChoice(ws: CustomWebSocket, payload: { choice: Choice }): void {
  const { choice } = payload;
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  if (room.status !== "playing") {
    return sendToClient(ws, "ERROR", { message: "O jogo não está em andamento." });
  }
  if (!["rock", "paper", "scissors"].includes(choice)) {
    return sendToClient(ws, "ERROR", { message: "Escolha inválida." });
  }
  if (room.choices.has(ws.clientId)) {
    return sendToClient(ws, "ERROR", { message: "Você já fez sua escolha nesta rodada." });
  }

  room.choices.set(ws.clientId, choice);
  log(`Jogador ${ws.clientUsername} escolheu ${choice}.`, { ws });
  sendToClient(ws, "CHOICE_MADE", { choice });

  // BUGFIX: Notify all other participants (opponent and spectators)
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(p => {
    // Send to everyone except the person who just made the choice
    if (p.ws && p.ws.clientId !== ws.clientId) {
        sendToClient(p.ws, "OPPONENT_CHOICE_MADE", { message: "O oponente fez uma jogada." });
    }
  });

  if (room.choices.size === 2) {
    processRoundResult(room);
  }
}

function processRoundResult(room: Room): void {
  const [player1Id, player2Id] = Array.from(room.choices.keys());
  const choice1 = room.choices.get(player1Id)!;
  const choice2 = room.choices.get(player2Id)!;

  const result = determineWinner(choice1, choice2);
  const winnerId = result === "player1" ? player1Id : result === "player2" ? player2Id : null;

  log(`Resultado da rodada na sala ${room.roomCode}: Vencedor ID: ${winnerId ?? "Empate"}.`);

  const resultPayload = {
    choices: { [player1Id]: choice1, [player2Id]: choice2 },
    winnerId,
    players: {
      [player1Id]: room.players.get(player1Id)!.username,
      [player2Id]: room.players.get(player2Id)!.username,
    },
  };
  
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(p => {
    if (p.ws) sendToClient(p.ws, "GAME_RESULT", resultPayload);
  });

  setTimeout(() => startNewRound(room), 10000);
  room.status = 'waiting'; // Waiting for the new round to start
}

function startNewRound(room: Room) {
  log(`Iniciando nova rodada na sala ${room.roomCode}.`);
  room.choices.clear();
  room.status = "playing"; // Set status to 'playing' for the new round

  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(p => {
    if (p.ws) sendToClient(p.ws, "NEW_ROUND", { message: "Nova rodada! Façam suas escolhas." });
  });
  broadcastRoomState(room); // Broadcast the new state with cleared choices and correct status
}

function determineWinner(choice1: Choice, choice2: Choice): "player1" | "player2" | "draw" {
  if (choice1 === choice2) return "draw";
  if (
    (choice1 === "rock" && choice2 === "scissors") ||
    (choice1 === "scissors" && choice2 === "paper") ||
    (choice1 === "paper" && choice2 === "rock")
  ) {
    return "player1";
  }
  return "player2";
}

function getOpponent(room: Room, currentPlayerId: string): Participant | undefined {
  for (const [playerId, player] of room.players.entries()) {
    if (playerId !== currentPlayerId) return player;
  }
  return undefined;
}

function handleCloseRoom(ws: CustomWebSocket): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  log(`Sala ${room.roomCode} está sendo fechada pelo dono ${ws.clientUsername}.`, { ws });
  const closePayload = { message: `A sala ${room.roomCode} foi fechada pelo dono.` };
  
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(p => {
    if (p.ws) {
      sendToClient(p.ws, "ROOM_CLOSED", closePayload);
      p.ws.currentRoomCode = "";
    }
  });

  roomGlobal.delete(room.roomCode);
}

function handlePlayerDisconnect(ws: CustomWebSocket): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  // FEATURE/FIX: This part is correct. Spectators are fully removed on disconnect.
  if (room.spectators.has(ws.clientId)) {
    log(`Espectador ${ws.clientUsername} saiu da sala ${room.roomCode}.`, { ws });
    room.spectators.delete(ws.clientId);
    broadcastRoomState(room); // Notify everyone that the spectator list changed
    return;
  }

  // Handle player disconnect: keep them for reconnection.
  const participant = room.players.get(ws.clientId);
  if (participant) {
    participant.ws = null; // Mark as disconnected but keep player data
    log(`Jogador ${ws.clientUsername} desconectou da sala ${room.roomCode}.`, { ws });

    // BUGFIX: Notify the opponent AND spectators about the disconnection.
    const allParticipants = [...room.players.values(), ...room.spectators.values()];
    allParticipants.forEach(p => {
      // Send to everyone who is currently connected (their ws will not be null)
      if (p.ws) {
        sendToClient(p.ws, "OPPONENT_DISCONNECTED", {
          username: ws.clientUsername,
          message: `${ws.clientUsername} se desconectou.`,
        });
      }
    });

    // Also broadcast the room state so UIs can reflect the disconnection (isOnline: false)
    broadcastRoomState(room);
  }
}

function getAvailableRoomsForApi(currentUserId: string): RoomStateForApi[] {
  return Array.from(roomGlobal.values()).map(room => getRoomStateForApi(room, currentUserId));
}

// Export functions to be used by controllers
export {
    createRoomForApi,
    getAvailableRoomsForApi
};