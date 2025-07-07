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
      RoomManager.handlePlayerDisconnect(ws);
      break;
  }
}