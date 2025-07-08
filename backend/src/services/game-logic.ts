import { setRoomHands, getRoomHands, getRoom } from "./gameState";
import { CardGame, CardType, CustomWebSocket, Room } from "../models/types.model";
import { log } from "../utils/logger";
import { broadcastToRoom, broadcastToOthers, getNextPlayer, sendToClient } from "../utils/websocket.util";
import { dealCards, canPlayCard } from "./cards.service";
import { MAX_PLAYERS, TURN_TIME_LIMIT, CARDS_PER_PLAYER, CARDS_PER_TYPE, JOKERS_COUNT } from "../config/game.config";
import { getRoomStateForApi } from "./room.manager";

/**
 * Starts the card game in the given room.
 * This function initializes the game state, deals cards, and starts the first turn.
 * @param room The room where the game will start.
 */
export function startCardGame(room: Room & { game: CardGame }): void {
  log(`Starting card game in room ${room.roomCode} with ${room.players.size} players.`);
  
  // Initialize game state for a new game
  room.status = "playing";
  room.game = {
    ...room.game,
    phase: "playing",
    roundNumber: 1,
    currentPlayerIndex: 0, // First player in the map
    currentCardType: null,
    playedCards: [],
    lastPlayedCard: null,
    lastPlayerId: null,
    direction: 1,
  };
  
  // Deal cards to players
  const hands = dealCards(room);
  setRoomHands(room.roomCode, hands);
  
  // Determine the first player
  const firstPlayerId = Array.from(room.players.keys())[0];
  
  // Notify all players that the game has started
  broadcastToRoom(room, "GAME_STARTED", {
    message: "The game has begun! The first player must choose a card type to play.",
    currentPlayerId: firstPlayerId,
    players: getRoomStateForApi(room, '').players, // Send initial state of all players
    gameRules: {
      cardsPerPlayer: CARDS_PER_PLAYER,
      cardTypes: ['king', 'queen', 'ace', 'joker'],
      cardsPerType: CARDS_PER_TYPE,
      jokersCount: JOKERS_COUNT,
      maxPlayers: MAX_PLAYERS,
      turnTimeLimit: TURN_TIME_LIMIT
    }
  });
  
  // Send each player their specific hand
  const roomHands = getRoomHands(room.roomCode);
  if (roomHands) {
    room.players.forEach((player, playerId) => {
      const hand = roomHands.get(playerId);
      if (hand && player.ws) {
        sendToClient(player.ws, "HAND_DEALT", {
          cards: hand.cards,
          handSize: hand.cards.length,
        });
      }
    });
  }

  // Start the first player's turn
  startPlayerTurn(room, firstPlayerId);
}

/**
 * Advances the turn to the next non-eliminated player after an interruption (e.g., timeout, disconnection).
 * @param room The game room object.
 */
export function advanceTurnAfterInterruption(room: Room & { game: CardGame }): void {
  log(`Advancing turn in room ${room.roomCode} due to an interruption.`);
  
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }
  
  // Pass to the next player
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    startPlayerTurn(room, nextPlayerId);
  } else {
    log(`No valid next player found in room ${room.roomCode}. Game might be over.`);
    // Here you could add logic to end the game if only one player is left
  }
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
    // If the player is not available, advance the turn immediately.
    advanceTurnAfterInterruption(room);
    return;
  }

  log(`Turn of player ${player.username} in room ${room.roomCode}.`);
  
  // Clear any previous turn timer
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
  }
  
  const isFirstPlayOfRound = room.game.currentCardType === null;
  const canChallenge = room.game.lastPlayerId !== null && room.game.lastPlayerId !== playerId;

  // Notify the current player
  sendToClient(player.ws, "YOUR_TURN", {
    message: isFirstPlayOfRound 
      ? "Your turn! Choose a card type to start the round." 
      : `Your turn! The current card type is: ${room.game.currentCardType}.`,
    timeLimit: room.game.turnTimeLimit,
    currentCardType: room.game.currentCardType,
    canChallenge,
  });
  
  // Notify other players
  broadcastToOthers(room, player.ws, "PLAYER_TURN", {
    currentPlayerId: playerId,
    playerName: player.username,
    message: `It's ${player.username}'s turn.`,
    currentCardType: room.game.currentCardType
  });
  
  // Start the turn timer
  room.game.turnTimer = setTimeout(() => {
    handleTurnTimeout(room, playerId);
  }, room.game.turnTimeLimit);
}

// Placeholder for future implementation
export function handlePlayCard(ws: CustomWebSocket, payload: { cardId: string; declaredType?: CardType }): void {
  // Logic to be implemented in the next step
}

// Placeholder for future implementation
export function handleChallengePlayer(ws: CustomWebSocket, payload: { targetPlayerId: string }): void {
  // Logic to be implemented in a future step
}

function handleTurnTimeout(room: Room & { game: CardGame }, playerId: string): void {
  log(`Turn timeout for player ${playerId} in room ${room.roomCode}.`);
  
  const player = room.players.get(playerId);
  if (!player) return;

  // Notify the player who timed out
  if(player.ws) {
    sendToClient(player.ws, "TURN_TIMEOUT", {
      message: "Time's up! You missed your turn."
    });
  }
  
  // Notify other players
  broadcastToOthers(room, player.ws!, "PLAYER_TIMEOUT", {
    playerId,
    playerName: player.username,
    message: `${player.username} ran out of time and missed their turn.`
  });
  
  // Advance to the next player
  advanceTurnAfterInterruption(room);
}