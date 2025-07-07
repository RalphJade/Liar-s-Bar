import { log } from "./logger";
import { CardGame, CustomWebSocket, ServerMessage, Room } from "../models/types.model";

export function sendToClient<T extends ServerMessage["type"]>(
  ws: CustomWebSocket,
  type: T,
  payload: Extract<ServerMessage, { type: T }>["payload"]
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    log("Tentativa de envio para um WebSocket fechado.", { ws, data: { type } });
    return;
  }
  const message = { type, payload };
  ws.send(JSON.stringify(message));
}

// Envia uma mensagem para todos em uma sala
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
  ws: CustomWebSocket,
  type: T,
  payload: Extract<ServerMessage, { type: T, payload: any }>["payload"]
): void {
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(participant => {
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      sendToClient(participant.ws, type, payload);
    }
  });
}

export function getNextPlayer(room: Room & { game: CardGame }): string | null {
  const playerIds = Array.from(room.players.keys());
  const currentIndex = room.game.currentPlayerIndex;
  const nextIndex = (currentIndex + room.game.direction + playerIds.length) % playerIds.length;
  
  room.game.currentPlayerIndex = nextIndex;
  return playerIds[nextIndex];
}