import { log } from "./logger";
import { CustomWebSocket, ServerMessage, Room } from "../models/types.model";
import { WebSocket } from "ws";
import { getRoomHands } from "../services/gameState";

export function sendToClient<T extends ServerMessage["type"]>(
  ws: CustomWebSocket,
  type: T,
  payload: Extract<ServerMessage, { type: T }>["payload"]
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    log("Attempted to send to a closed WebSocket.", { ws, data: { type } });
    return;
  }
  const message = { type, payload };
  ws.send(JSON.stringify(message));
}

export function broadcastToRoom(
  room: Room,
  type: ServerMessage['type'],
  payload: any
): void {
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  const message = { type, payload };
  const serializedMessage = JSON.stringify(message);

  allParticipants.forEach(participant => {
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(serializedMessage);
    }
  });
}

/**
 * Sends a message to all participants in a room except for the original sender.
 * @param room The room object.
 * @param senderWs The WebSocket of the client who sent the original message.
 * @param type The type of the message to send.
 * @param payload The payload of the message.
 */
export function broadcastToOthers<T extends ServerMessage["type"]>(
  room: Room,
  senderWs: CustomWebSocket,
  type: T,
  payload: Extract<ServerMessage, { type: T, payload: any }>["payload"]
): void {
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(participant => {
    // Corrected logic: only send if the participant is not the original sender
    if (participant.ws && participant.ws.clientId !== senderWs.clientId && participant.ws.readyState === WebSocket.OPEN) {
      sendToClient(participant.ws, type, payload);
    }
  });
}


/**
 * Finds the next valid (non-eliminated) player in the turn order.
 * @param room The game room object.
 * @returns The ID of the next player, or null if no valid player is found.
 */
export function getNextPlayer(room: Room & { game: { currentPlayerIndex: number; direction: 1 | -1 } }): string | null {
  const playerIds = Array.from(room.players.keys());
  if (playerIds.length < 2) return null; // Can't get a next player if there's only one or zero

  const roomHands = getRoomHands(room.roomCode);
  if (!roomHands) return null;

  let attempts = 0;
  let nextIndex = room.game.currentPlayerIndex;

  do {
      nextIndex = (nextIndex + room.game.direction + playerIds.length) % playerIds.length;
      const nextPlayerId = playerIds[nextIndex];
      const nextPlayerHand = roomHands.get(nextPlayerId);
      
      // If the next player is not eliminated, they are the one.
      if (nextPlayerHand && !nextPlayerHand.isEliminated) {
          return nextPlayerId;
      }
      attempts++;
  } while (attempts < playerIds.length);
  
  // If we loop through everyone and can't find a non-eliminated player (e.g., game over).
  return null; 
}