import { log } from "./logger";
import { CardGame, CustomWebSocket, ServerMessage, Room } from "../models/types.model";
import { WebSocket } from "ws";

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

export function broadcastToOthers<T extends ServerMessage["type"]>(
  room: Room & { game: CardGame },
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

export function getNextPlayer(room: Room & { game: CardGame }): string | null {
  const playerIds = Array.from(room.players.keys());
  if (playerIds.length === 0) return null;

  const roomHands = getRoomHands(room.roomCode);

  let attempts = 0;
  let nextIndex = room.game.currentPlayerIndex;

  do {
      nextIndex = (nextIndex + room.game.direction + playerIds.length) % playerIds.length;
      const nextPlayerId = playerIds[nextIndex];
      const nextPlayerHand = roomHands?.get(nextPlayerId);
      
      // If the next player is not eliminated, they are the one.
      if (nextPlayerHand && !nextPlayerHand.isEliminated) {
          room.game.currentPlayerIndex = nextIndex;
          return nextPlayerId;
      }
      attempts++;
  } while (attempts < playerIds.length);
  
  // If we loop through everyone and can't find a non-eliminated player.
  return null; 
}