import { Room, PlayerHand, CardGame, ChatMessage } from "../models/types.model";

const gameRooms = new Map<string, Room & { game: CardGame }>();
const playerHands = new Map<string, Map<string, PlayerHand>>();
const roomChatHistories = new Map<string, ChatMessage[]>();

export function getRoom(roomCode: string): (Room & { game: CardGame }) | undefined {
    return gameRooms.get(roomCode);
}

export function addRoom(roomCode: string, room: Room & { game: CardGame }): void {
    gameRooms.set(roomCode, room);
    playerHands.set(roomCode, new Map());
    roomChatHistories.set(roomCode, []);
}

export function removeRoom(roomCode: string): void {
    gameRooms.delete(roomCode);
    playerHands.delete(roomCode);
    roomChatHistories.delete(roomCode);
}

export function getAllRooms(): (Room & { game: CardGame })[] {
    return Array.from(gameRooms.values());
}

export function getHand(roomCode: string, playerId: string): PlayerHand | undefined {
    return playerHands.get(roomCode)?.get(playerId);
}

export function getRoomHands(roomCode: string): Map<string, PlayerHand> | undefined {
    return playerHands.get(roomCode);
}

export function setRoomHands(roomCode: string, hands: Map<string, PlayerHand>): void {
    playerHands.set(roomCode, hands);
}

export function isUserInAnyRoom(userId: string): boolean {
  for (const room of gameRooms.values()) {
    if (room.players.has(userId) || room.spectators.has(userId)) {
      return true;
    }
  }
  return false;
}

export function addRoomMessage(roomCode: string, message: ChatMessage): void {
    const history = roomChatHistories.get(roomCode);
    if (history) {
        history.push(message);
        if (history.length > 50) { // Limita o histórico
            history.shift();
        }
    }
}

export function getRoomChatHistory(roomCode: string): ChatMessage[] {
    return roomChatHistories.get(roomCode) || [];
}