import { pool } from "../database";
import { log } from "./logger";
import { CustomWebSocket, CardGame, RoomStateForApi, ServerMessage, Room } from "../models/types.model";
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
  const roomHands = getRoomHands(room.roomCode);
  if (!roomHands) return null;

  const playerIds = Array.from(room.players.keys());
  const currentIndex = room.game.currentPlayerIndex;

  for (let i = 1; i <= playerIds.length; i++) {
    const nextIndex = (currentIndex + i) % playerIds.length;
    const nextPlayerId = playerIds[nextIndex];
    const nextPlayerHand = roomHands.get(nextPlayerId);
    const nextParticipant = room.players.get(nextPlayerId);
    
    // SKIP eliminated OR inactive players
    if (nextPlayerHand && nextParticipant && nextParticipant.ws !== null && !nextPlayerHand.isEliminated && !nextPlayerHand.isInactive) {
      return nextPlayerId;
    }
  }
  
  return null;
  
}

export function broadcastRoomState(room: Room & { game: CardGame }): void {
  log(`Broadcasting room state ${room.roomCode} to all participants.`);
  const allParticipants = [...room.players.values(), ...room.spectators.values()];

  allParticipants.forEach(async (participant) => {
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      const personalRoomState = await getRoomStateForApi(room, participant.ws.clientId);
      sendToClient(participant.ws, "ROOM_STATE_UPDATE", personalRoomState);
    }
  });
}

export async function getRoomStateForApi(
  room: Room & { game: CardGame },
  currentUserId: string
): Promise<RoomStateForApi> {
  const roomHands = getRoomHands(room.roomCode);
  const currentPlayerHand = roomHands?.get(currentUserId);

  const playerIds = Array.from(room.players.keys());
  const userAvatars = new Map<string, string | null>();

  if (playerIds.length > 0) {
      const result = await pool.query<{ id: string, avatar_url: string | null }>(
          'SELECT id, avatar_url FROM users WHERE id = ANY($1::uuid[])',
          [playerIds]
      );
      result.rows.forEach(row => userAvatars.set(row.id, row.avatar_url));
  }
  
  return {
    roomCode: room.roomCode,
    ownerId: room.ownerId,
    players: Array.from(room.players.entries()).map(([id, p]) => {
      const hand = roomHands?.get(id);
      let reconnectTimeLeft: number | null = null;
      if (p.reconnectingUntil) {
        const timeLeftMs = p.reconnectingUntil - Date.now();
        reconnectTimeLeft = timeLeftMs > 0 ? Math.round(timeLeftMs / 1000) : 0;
      }
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
        isInactive: hand?.isInactive || false,
        avatar_url: userAvatars.get(id) || null,
        reconnectTimeLeft: reconnectTimeLeft,
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
      currentPlayerId: playerIds[room.game.currentPlayerIndex] || null,
      currentCardType: room.game.currentCardType,
      roundNumber: room.game.roundNumber,
      direction: room.game.direction,
      playedCardsCount: room.game.playedCards.length,
      deckSize: room.game.deck.length,
      lastPlayerId: room.game.lastPlayerId,
      lastPlayedCard: room.game.lastPlayedCard,
    },
    myCards: currentPlayerHand?.cards || [],
    myHandSize: currentPlayerHand?.cards.length || 0,
  };
}