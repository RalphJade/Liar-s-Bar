import { Server as WebSocketServer } from "ws";
import { ClientMessage, CustomWebSocket } from "../models/types.model";
import { log } from "../utils/logger";
import { sendToClient } from "../utils/websocket.util";

import * as LobbyManager from "./lobby.manager"
import * as RoomManager from "./room.manager"
import * as GameLogic from "./game-logic"

/**
 * Initializes the main WebSocket server and its event listeners.
 * @param wss The WebSocket server instance.
 */
export function initializeGameService(wss: WebSocketServer): void {
  wss.on("connection", async (ws: CustomWebSocket) => {
    const reconnected = await RoomManager.attemptPlayerReconnection(ws);

    if (!reconnected) {
      LobbyManager.handleNewConnection(ws);
      RoomManager.handleWaitingRooms(ws);
    }

    ws.on("message", (message) => {
      try {
        const data: ClientMessage = JSON.parse(message.toString());
        log("Message received.", { ws, data });
        handleClientMessage(ws, data);
      } catch (error: any) {
        log("Error handling client message.", { ws, data: { error: error.message, originalMessage: message.toString() } });
      }
    });

    ws.on("close", () => {
      RoomManager.handlePlayerDisconnect(ws);
    });

    ws.on("error", (error) => {
      log("WebSocket error.", { ws, data: { error: error.message } });
    });
  });
}

/**
 * Central message router for all incoming WebSocket messages.
 * It directs the message to the appropriate handler based on its type.
 * @param ws The WebSocket connection from which the message originated.
 * @param data The parsed message object from the client.
 */
function handleClientMessage(ws: CustomWebSocket, data: ClientMessage): void {
  if (!data.type || data.payload === undefined) {
    sendToClient(ws, "ERROR", { message: "Invalid message format." });
    return;
  }

  if (!ws.currentRoomCode) {
    switch (data.type) {
      case "LIST_ROOMS":
        RoomManager.handleWaitingRooms(ws);
        break;
      case "CREATE_ROOM":
        RoomManager.handleCreateRoom(ws, data.payload);
        break;
      case "JOIN_ROOM":
        RoomManager.handlePlayerJoinRoom(ws, data.payload);
        break;
      case "CHAT_MESSAGE":
        LobbyManager.handleChatMessage(ws, data.payload);
        break;
      default:
        sendToClient(ws, "ERROR", { message: "Action not allowed outside of a room." });
    }
  } else {
    // If the user is in a room, they can perform game actions.
    switch (data.type) {
      case "PLAY_CARD":
        GameLogic.handlePlayCard(ws, data.payload);
        break;
      case "CALL_BLUFF":
        GameLogic.handleCallBluff(ws);
        break;
      case "READY_FOR_NEXT_GAME":
        RoomManager.handleReadyForNextGame(ws);
        break;
      case "LEAVE_ROOM":
        RoomManager.handleLeaveRoom(ws);
        break;
      case "CHAT_MESSAGE":
        RoomManager.handleRoomChatMessage(ws, data.payload);
        break;
      // Actions like CREATE/JOIN are blocked if already in a room.
      case "CREATE_ROOM":
      case "JOIN_ROOM":
        sendToClient(ws, "ERROR", { message: "You are already in a room." });
        break;
      default:
        sendToClient(ws, "ERROR", { message: `Unknown action type: ${data.type}` });
    }
  }
}