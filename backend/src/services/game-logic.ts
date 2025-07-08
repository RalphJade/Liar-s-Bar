import { setRoomHands, getRoomHands, getRoom } from "./gameState";
import { Card, CardGame, CardType, CustomWebSocket, Room } from "../models/types.model";
import { log } from "../utils/logger";
import { broadcastToRoom, broadcastToOthers, getNextPlayer, sendToClient } from "../utils/websocket.util";
import { dealCards } from "./cards.service";
import { MAX_PLAYERS, TURN_TIME_LIMIT, CARDS_PER_PLAYER, CARDS_PER_TYPE, JOKERS_COUNT } from "../config/game.config";
import { getRoomStateForApi, broadcastRoomState } from "./room.manager";

export async function startCardGame(room: Room & { game: CardGame }): Promise<void> {
  log(`Starting card game in room ${room.roomCode} with ${room.players.size} players.`);
  
  const hands = dealCards(room);
  setRoomHands(room.roomCode, hands);

  let referenceCard: Card | undefined;
  do {
    referenceCard = room.game.deck.pop();
  } while (referenceCard && referenceCard.type === 'joker');

  if (!referenceCard) {
    log(`Could not draw a valid reference card for room ${room.roomCode}.`, { data: room.game.deck });
    broadcastToRoom(room, "ERROR", { message: "Error starting game: could not set a reference card." });
    return;
  }
  
  room.game.playedCards.push(referenceCard);
  
  room.status = "playing";
  room.game.phase = "playing";
  room.game.roundNumber = 1;
  room.game.currentPlayerIndex = 0;
  room.game.currentCardType = referenceCard.type as Exclude<CardType, 'joker'>;
  room.game.lastPlayedCard = null;
  room.game.lastPlayerId = null; 
  room.game.direction = 1;

  const firstPlayerId = Array.from(room.players.keys())[0];
  
  await broadcastRoomState(room);

  broadcastToRoom(room, "GAME_STARTED", {
    message: `The game has begun! The required card is ${room.game.currentCardType}.`,
    currentPlayerId: firstPlayerId,
    players: (await getRoomStateForApi(room, '')).players,
    gameRules: {
      cardsPerPlayer: CARDS_PER_PLAYER,
      cardTypes: ['king', 'queen', 'ace', 'joker'],
      cardsPerType: CARDS_PER_TYPE,
      jokersCount: JOKERS_COUNT,
      maxPlayers: MAX_PLAYERS,
      turnTimeLimit: TURN_TIME_LIMIT
    }
  });

  startPlayerTurn(room, firstPlayerId);
}

export function advanceTurn(room: Room & { game: CardGame }): void {
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    room.game.currentPlayerIndex = Array.from(room.players.keys()).indexOf(nextPlayerId);
    startPlayerTurn(room, nextPlayerId);
  } else {
    log(`No valid next player found in room ${room.roomCode}. Game might be over.`);
    // TODO: Implement game over logic
  }
}

export function advanceTurnAfterInterruption(room: Room & { game: CardGame }): void {
  log(`Advancing turn in room ${room.roomCode} due to an interruption.`);
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }
  advanceTurn(room);
}

export function startPlayerTurn(room: Room & { game: CardGame }, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player || !player.ws) {
    log(`Cannot start turn for player ${playerId}: not found or not connected.`, { data: { roomCode: room.roomCode } });
    advanceTurnAfterInterruption(room);
    return;
  }
  
  log(`Turn of player ${player.username} in room ${room.roomCode}.`);
  
  if (room.game.turnTimer) clearTimeout(room.game.turnTimer);
  
  const canChallenge = room.game.lastPlayerId !== null && room.game.lastPlayerId !== playerId;

  sendToClient(player.ws, "YOUR_TURN", {
    message: `Your turn! You must play a ${room.game.currentCardType}.`,
    timeLimit: room.game.turnTimeLimit,
    currentCardType: room.game.currentCardType,
    canChallenge,
  });
  
  broadcastToOthers(room, player.ws, "PLAYER_TURN", {
    currentPlayerId: playerId,
    playerName: player.username,
    message: `It's ${player.username}'s turn.`,
    currentCardType: room.game.currentCardType
  });
  
  room.game.turnTimer = setTimeout(() => handleTurnTimeout(room, playerId), room.game.turnTimeLimit);
}

export function handlePlayCard(ws: CustomWebSocket, payload: { cardId: string }): void {
  const { cardId } = payload;
  const roomCode = ws.currentRoomCode;
  const room = roomCode ? getRoom(roomCode) : undefined;
  
  if (!room || room.status !== 'playing') return;
  
  const playerIds = Array.from(room.players.keys());
  if (playerIds[room.game.currentPlayerIndex] !== ws.clientId) {
    sendToClient(ws, "ERROR", { message: "It's not your turn." });
    return;
  }

  const roomHands = getRoomHands(room.roomCode);
  const playerHand = roomHands?.get(ws.clientId);
  const cardToPlay = playerHand?.cards.find(c => c.id === cardId);

  if (!playerHand || !cardToPlay) {
    sendToClient(ws, "ERROR", { message: "You don't have that card." });
    return;
  }

  log(`Player ${ws.clientUsername} is playing card ${cardId}.`);

  // State mutation
  playerHand.cards = playerHand.cards.filter(c => c.id !== cardId);
  room.game.playedCards.push(cardToPlay);
  room.game.lastPlayedCard = cardToPlay;
  room.game.lastPlayerId = ws.clientId;
  
  // Confirmation to sender
  sendToClient(ws, "CARD_PLAYED_CONFIRMATION", {
    cardId,
    handSize: playerHand.cards.length,
    message: `You played your card.`
  });

  // Broadcast the new state to everyone
  broadcastRoomState(room);

  // Advance the turn
  advanceTurn(room);
}

export function handleCallBluff(ws: CustomWebSocket): void {
  log("handleCallBluff to be implemented", { ws });
}

function handleTurnTimeout(room: Room & { game: CardGame }, playerId: string): void {
  log(`Turn timeout for player ${playerId} in room ${room.roomCode}.`);
  const player = room.players.get(playerId);
  if (!player) return;

  if(player.ws) {
    sendToClient(player.ws, "TURN_TIMEOUT", { message: "Time's up! You missed your turn." });
  }
  
  broadcastToOthers(room, player.ws!, "PLAYER_TIMEOUT", {
    playerId,
    playerName: player.username,
    message: `${player.username} ran out of time and missed their turn.`
  });
  
  advanceTurnAfterInterruption(room);
}