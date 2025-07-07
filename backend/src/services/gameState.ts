import { Room, PlayerHand, CardGame } from "../models/types.model";

const gameRooms = new Map<string, Room & { game: CardGame }>();
const playerHands = new Map<string, Map<string, PlayerHand>>();

export function getRoom(roomCode: string): (Room & { game: CardGame }) | undefined {
    return gameRooms.get(roomCode);
}

export function addRoom(roomCode: string, room: Room & { game: CardGame }): void {
    gameRooms.set(roomCode, room);
    playerHands.set(roomCode, new Map());
}

export function removeRoom(roomCode: string): void {
    gameRooms.delete(roomCode);
    playerHands.delete(roomCode);
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
