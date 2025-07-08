import { setRoomHands, getRoomHands, getRoom } from "./gameState";
import { Card, CardGame, CardType, CustomWebSocket, Room } from "../models/types.model";
import { log } from "../utils/logger";
import { broadcastToRoom, broadcastToOthers, getNextPlayer, sendToClient } from "../utils/websocket.util";
import { dealCards } from "./cards.service";
import { MAX_PLAYERS, TURN_TIME_LIMIT, CARDS_PER_PLAYER, CARDS_PER_TYPE, JOKERS_COUNT } from "../config/game.config";
import { getRoomStateForApi, broadcastRoomState } from "./room.manager";
import { updatePlayerStatsAfterGame } from "./user.service";

/**
 * Simulates spinning the roulette for a punished player.
 * @param riskLevel The current risk level (0-5) of the player.
 * @returns {boolean} True if the player is eliminated, false otherwise.
 */
function spinRoulette(riskLevel: number): boolean {
    const chamberCount = 6;
    const loadedChambers = riskLevel;
    const randomSpin = Math.floor(Math.random() * chamberCount);
    
    return randomSpin < loadedChambers;
}

export async function startCardGame(room: Room & { game: CardGame }): Promise<void> {
  log(`Starting card game in room ${room.roomCode} with ${room.players.size} players.`);
  
  const hands = dealCards(room);
  setRoomHands(room.roomCode, hands);

  const roomHands = getRoomHands(room.roomCode)!;
  roomHands.forEach(hand => {
    hand.isEliminated = false;
    hand.riskLevel = 0;
  });

  room.status = "playing";
  room.game.phase = "playing";
  room.game.roundNumber = 0;
  
  const firstPlayerId = Array.from(room.players.keys())[0];
  
  await broadcastRoomState(room);

  startNewRound(room, firstPlayerId, true);
}
  
export function advanceTurn(room: Room & { game: CardGame }): void {
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    startPlayerTurn(room, nextPlayerId);
  } else {
    log(`No valid next player found in room ${room.roomCode}. Checking for winner.`);
    checkForWinner(room);
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
  const playerIds = Array.from(room.players.keys());
  const player = room.players.get(playerId);
  if (!player || !player.ws) {
    log(`Cannot start turn for player ${playerId}: not found or not connected.`, { data: { roomCode: room.roomCode } });
    advanceTurnAfterInterruption(room);
    return;
  }
  
  room.game.currentPlayerIndex = playerIds.indexOf(playerId);
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
    return sendToClient(ws, "ERROR", { message: "It's not your turn." });
  }

  const roomHands = getRoomHands(room.roomCode);
  const playerHand = roomHands?.get(ws.clientId);
  const cardToPlay = playerHand?.cards.find(c => c.id === cardId);

  if (!playerHand || !cardToPlay) {
    return sendToClient(ws, "ERROR", { message: "You don't have that card." });
  }

  log(`Player ${ws.clientUsername} is playing card ${cardId}.`);

  playerHand.cards = playerHand.cards.filter(c => c.id !== cardId);
  room.game.lastPlayedCard = cardToPlay;
  room.game.lastPlayerId = ws.clientId;
  
  broadcastRoomState(room);
  advanceTurn(room);
}

export function handleCallBluff(ws: CustomWebSocket): void {
    const roomCode = ws.currentRoomCode;
    const room = roomCode ? getRoom(roomCode) : undefined;
  
    if (!room || room.status !== 'playing') return;
  
    const playerIds = Array.from(room.players.keys());
    if (playerIds[room.game.currentPlayerIndex] !== ws.clientId) {
        return sendToClient(ws, "ERROR", { message: "It's not your turn to call a bluff." });
    }
  
    const targetId = room.game.lastPlayerId;
    if (!targetId || !room.game.lastPlayedCard) {
        return sendToClient(ws, "ERROR", { message: "There is no play to challenge." });
    }
  
    const challengerId = ws.clientId;
    const challenger = room.players.get(challengerId);
    const target = room.players.get(targetId);
  
    if (!challenger || !target) return;
  
    log(`Challenge in room ${room.roomCode}: ${challenger.username} challenges ${target.username}.`);
  
    const revealedCard = room.game.lastPlayedCard;
    const requiredType = room.game.currentCardType!;
    const wasLie = revealedCard.type !== requiredType && revealedCard.type !== 'joker';
  
    const punishedPlayerId = wasLie ? targetId : challengerId;
    let message: string;
  
    const roomHands = getRoomHands(room.roomCode);
    const punishedHand = roomHands?.get(punishedPlayerId);
    if (!punishedHand) return;

    punishedHand.riskLevel += 1;
    const eliminatedOnThisTurn = spinRoulette(punishedHand.riskLevel);

    if (wasLie) {
        message = `${target.username} was caught bluffing with a ${revealedCard.type}!`;
    } else {
        message = `${challenger.username} falsely accused ${target.username}! The card was a ${revealedCard.type}.`;
    }

    message += ` ${room.players.get(punishedPlayerId)!.username} spins the roulette...`;
    
    if (eliminatedOnThisTurn) {
        punishedHand.isEliminated = true;
        message += ` *BANG!*... and has been ELIMINATED!`;
    } else {
        message += ` *CLICK*... and survives. Their risk is now ${punishedHand.riskLevel}/6.`;
    }

    broadcastToRoom(room, "CHALLENGE_RESULT", {
        wasLie,
        punishedPlayerId,
        punishedPlayerName: room.players.get(punishedPlayerId)!.username,
        revealedCard,
        message,
        isEliminated: eliminatedOnThisTurn,
        newRiskLevel: punishedHand.riskLevel,
    });
    
    setTimeout(() => {
        if (checkForWinner(room)) {
            return;
        }

        const punishedPlayerIsChallenger = punishedPlayerId === challengerId;
        const challengerWasEliminated = punishedPlayerIsChallenger && eliminatedOnThisTurn;

        let nextTurnPlayerId = challengerId;
        if (challengerWasEliminated) {
            room.game.currentPlayerIndex = playerIds.indexOf(challengerId);
            const nextId = getNextPlayer(room);
            if (nextId) {
                nextTurnPlayerId = nextId;
            } else {
                checkForWinner(room);
                return;
            }
        }
        
        startNewRound(room, nextTurnPlayerId, false, revealedCard.type);
    }, 5500);
}

function startNewRound(room: Room & { game: CardGame }, startingPlayerId: string, isFirstRound: boolean = false, newCardType?: CardType) {
    if (!isFirstRound) {
        log(`Starting new round in room ${room.roomCode}.`);
        room.game.roundNumber += 1;
    }
    
    let referenceType = newCardType;
    if (referenceType === 'joker' || !referenceType) {
        let newReferenceCard: Card | undefined;
        do {
            newReferenceCard = room.game.deck.pop();
        } while (newReferenceCard && newReferenceCard.type === 'joker');

        if (!newReferenceCard) {
            checkForWinner(room);
            return;
        }
        referenceType = newReferenceCard.type;
    }

    room.game.currentCardType = referenceType as Exclude<CardType, 'joker'>;
    room.game.lastPlayedCard = null;
    room.game.lastPlayerId = null;
    room.game.playedCards = [];

    broadcastRoomState(room);
    startPlayerTurn(room, startingPlayerId);
}

function checkForWinner(room: Room & { game: CardGame }): boolean {
    const roomHands = getRoomHands(room.roomCode);
    if (!roomHands) return false;

    const allPlayerIds = Array.from(room.players.keys());
    const activePlayers = allPlayerIds.filter(id => !roomHands.get(id)?.isEliminated);

    if (activePlayers.length <= 1) {
        const winnerId = activePlayers.length === 1 ? activePlayers[0] : null;
        const winner = winnerId ? room.players.get(winnerId) : null;
        
        log(`Game over in room ${room.roomCode}. Winner: ${winner?.username || "Draw"}`);
        
        // Update stats for all original players
        updatePlayerStatsAfterGame(allPlayerIds, winnerId);

        room.status = "waiting"; 
        room.game.phase = "finished";

        broadcastToRoom(room, "GAME_FINISHED", {
            winnerId,
            winnerName: winner?.username || "Draw",
            message: `${winner?.username || "No one"} is the last one standing!`,
        });
        return true;
    }
    return false;
}

function handleTurnTimeout(room: Room & { game: CardGame }, playerId: string): void {
  log(`Turn timeout for player ${playerId} in room ${room.roomCode}.`);
  const player = room.players.get(playerId);
  if (!player) return;

  const roomHands = getRoomHands(room.roomCode);
  const timedOutHand = roomHands?.get(playerId);
  if (timedOutHand) {
      const eliminatedOnThisTurn = spinRoulette(timedOutHand.riskLevel);
      timedOutHand.riskLevel += 1;

      if (eliminatedOnThisTurn) {
          timedOutHand.isEliminated = true;
          broadcastToRoom(room, "PLAYER_ELIMINATED", {
              playerId: playerId,
              playerName: player.username,
              message: `${player.username} was eliminated by the roulette for taking too long!`
          });
      }
  }

  if (checkForWinner(room)) return;
  
  broadcastRoomState(room);
  advanceTurnAfterInterruption(room);
}