import { setRoomHands, getRoomHands, getRoom } from "./gameState";
import { Card, CardGame, CardType, CustomWebSocket, Room } from "../models/types.model";
import { log } from "../utils/logger";
import { broadcastToRoom, broadcastToOthers, getNextPlayer, sendToClient } from "../utils/websocket.util";
import { dealCards } from "./cards.service";
import { MAX_PLAYERS, TURN_TIME_LIMIT, CARDS_PER_PLAYER, CARDS_PER_TYPE, JOKERS_COUNT } from "../config/game.config";
import { getRoomStateForApi, broadcastRoomState } from "./room.manager";

/**
 * Starts the card game in the given room.
 * This function initializes the game state, deals cards, sets the reference card, and starts the first turn.
 * @param room The room where the game will start.
 */
export async function startCardGame(room: Room & { game: CardGame }): Promise<void> {
  log(`Starting card game in room ${room.roomCode} with ${room.players.size} players.`);
  
  // Deal cards to players, which also creates the deck
  const hands = dealCards(room);
  setRoomHands(room.roomCode, hands);

  // --- NEW LOGIC: Set the reference card ---
  let referenceCard: Card | undefined;
  // Draw a card from the deck until we get one that is not a Joker
  do {
    referenceCard = room.game.deck.pop();
  } while (referenceCard && referenceCard.type === 'joker');

  if (!referenceCard) {
    // This is an edge case, should not happen with current deck composition
    log(`Could not draw a valid reference card for room ${room.roomCode}.`, { data: room.game.deck });
    broadcastToRoom(room, "ERROR", { message: "Error starting game: could not set a reference card." });
    return;
  }
  
  // Add the reference card to the played pile so it's visible
  room.game.playedCards.push(referenceCard);
  // --- END NEW LOGIC ---

  // Initialize game state for a new game
  room.status = "playing";
  room.game.phase = "playing";
  room.game.roundNumber = 1;
  room.game.currentPlayerIndex = 0;
  room.game.currentCardType = referenceCard.type as Exclude<CardType, 'joker'>; // The required card type is set
  room.game.lastPlayedCard = referenceCard; // The reference card is the first "played" card
  room.game.lastPlayerId = null; // No one has played a card from their hand yet
  room.game.direction = 1;

  // Determine the first player
  const firstPlayerId = Array.from(room.players.keys())[0];
  
  // Notify all players that the game has started by broadcasting the new state
  await broadcastRoomState(room);

  // Announce the start and the first turn
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

  // Start the first player's turn
  startPlayerTurn(room, firstPlayerId);
}

/**
 * Advances the turn to the next non-eliminated player.
 * @param room The game room object.
 */
export function advanceTurn(room: Room & { game: CardGame }): void {
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    startPlayerTurn(room, nextPlayerId);
  } else {
    log(`No valid next player found in room ${room.roomCode}. Game might be over.`);
    // TODO: Implement game over logic
  }
}

/**
 * Advances the turn after an interruption (e.g., timeout, disconnection).
 * @param room The game room object.
 */
export function advanceTurnAfterInterruption(room: Room & { game: CardGame }): void {
  log(`Advancing turn in room ${room.roomCode} due to an interruption.`);
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }
  advanceTurn(room);
}

/**
 * Initiates a player's turn, notifying them and others, and starting a timer.
 * @param room The game room object.
 * @param playerId The ID of the player whose turn it is.
 */
export function startPlayerTurn(room: Room & { game: CardGame }, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player || !player.ws) {
    log(`Cannot start turn for player ${playerId}: not found or not connected.`, { data: { roomCode: room.roomCode } });
    advanceTurnAfterInterruption(room);
    return;
  }
  
  room.game.currentPlayerIndex = Array.from(room.players.keys()).indexOf(playerId);
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

/**
 * Handles a player's action to play a card.
 * @param ws The player's WebSocket.
 * @param payload The card being played.
 */
export async function handlePlayCard(ws: CustomWebSocket, payload: { cardId: string }): Promise<void> {
  const { cardId } = payload;
  const roomCode = ws.currentRoomCode;
  const room = roomCode ? getRoom(roomCode) : undefined;
  
  if (!room || room.status !== 'playing') return;
  
  const playerIds = Array.from(room.players.keys());
  if (playerIds[room.game.currentPlayerIndex] !== ws.clientId) {
    return sendToClient(ws, "ERROR", { message: "It's not your turn." });
  }

  const roomHands = getRoomHands(room.roomCode);
  const playerHand = roomHands?.get(ws.clientId);
  const cardToPlay = playerHand?.cards.find(c => c.id === cardId);

  if (!playerHand || !cardToPlay) {
    return sendToClient(ws, "ERROR", { message: "You don't have that card." });
  }

  log(`Player ${ws.clientUsername} plays card ${cardId}. The required type is ${room.game.currentCardType}`);

  // Move card from hand to played pile
  playerHand.cards = playerHand.cards.filter(c => c.id !== cardId);
  room.game.playedCards.push(cardToPlay);
  room.game.lastPlayedCard = cardToPlay;
  room.game.lastPlayerId = ws.clientId;
  
  // Confirm play to the player
  sendToClient(ws, "CARD_PLAYED_CONFIRMATION", {
    cardId,
    handSize: playerHand.cards.length,
    message: `You played your card.`
  });

  // Broadcast the updated state to all players
  await broadcastRoomState(room);

  // Advance the turn
  advanceTurn(room);
}

// Placeholder for future implementation
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