import { setRoomHands, getRoomHands, getRoom } from "./gameState";
import {
  Card,
  CardGame,
  CardType,
  CustomWebSocket,
  Room,
} from "../models/types.model";
import { log } from "../utils/logger";
import {
  broadcastToRoom,
  broadcastToOthers,
  getNextPlayer,
  sendToClient,
} from "../utils/websocket.util";
import { dealCards } from "./cards.service";
import {
  MAX_PLAYERS,
  TURN_TIME_LIMIT,
  CARDS_PER_PLAYER,
  CARDS_PER_TYPE,
  JOKERS_COUNT,
} from "../config/game.config";
import { getRoomStateForApi, broadcastRoomState } from "./room.manager";
import { updatePlayerStatsAfterGame } from "./user.service";

function spinRoulette(riskLevel: number): boolean {
  const chamberCount = 6;
  const loadedChambers = riskLevel;
  const randomSpin = Math.floor(Math.random() * chamberCount);
  return randomSpin < loadedChambers;
}

export async function startCardGame(
  room: Room & { game: CardGame }
): Promise<void> {
  log(
    `Starting card game in room ${room.roomCode} with ${room.players.size} players.`
  );

  const hands = dealCards(room);
  setRoomHands(room.roomCode, hands);

  const roomHands = getRoomHands(room.roomCode)!;
  roomHands.forEach((hand) => {
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
  if (checkForWinner(room)) {
    return;
  }
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    startPlayerTurn(room, nextPlayerId);
  } else {
    log(
      `No valid next player found in room ${room.roomCode}. Checking for winner.`
    );
    checkForWinner(room);
  }
}

export function advanceTurnAfterInterruption(
  room: Room & { game: CardGame }
): void {
  log(`Advancing turn in room ${room.roomCode} due to an interruption.`);
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }
  advanceTurn(room);
}

export function startPlayerTurn(
  room: Room & { game: CardGame },
  playerId: string
): void {
  const playerIds = Array.from(room.players.keys());
  const player = room.players.get(playerId);
  if (!player || !player.ws) {
    log(
      `Cannot start turn for player ${playerId}: not found or not connected.`,
      { data: { roomCode: room.roomCode } }
    );
    advanceTurnAfterInterruption(room);
    return;
  }

  room.game.currentPlayerIndex = playerIds.indexOf(playerId);
  log(`Turn of player ${player.username} in room ${room.roomCode}.`);

  if (room.game.turnTimer) clearTimeout(room.game.turnTimer);

  const canChallenge =
    room.game.lastPlayerId !== null && room.game.lastPlayerId !== playerId;

  sendToClient(player.ws, "YOUR_TURN", {
    message: `Your turn! The required card is ${room.game.currentCardType}.`,
    timeLimit: room.game.turnTimeLimit,
    currentCardType: room.game.currentCardType,
    canChallenge,
  });

  broadcastToOthers(room, player.ws, "PLAYER_TURN", {
    currentPlayerId: playerId,
    playerName: player.username,
    message: `It's ${player.username}'s turn.`,
    currentCardType: room.game.currentCardType,
  });

  room.game.turnTimer = setTimeout(
    () => handleTurnTimeout(room, playerId),
    room.game.turnTimeLimit
  );
}

export function handlePlayCard(
  ws: CustomWebSocket,
  payload: { cardsId: string[] }
): void {
  const { cardsId } = payload;
  const roomCode = ws.currentRoomCode;
  const room = roomCode ? getRoom(roomCode) : undefined;

  if (!room || room.status !== "playing") return;

  const playerIds = Array.from(room.players.keys());
  if (playerIds[room.game.currentPlayerIndex] !== ws.clientId) {
    return sendToClient(ws, "ERROR", { message: "It's not your turn." });
  }

  if (!cardsId || cardsId.length === 0) {
    return sendToClient(ws, "ERROR", {
      message: "You must select at least one card to play.",
    });
  }

  const roomHands = getRoomHands(room.roomCode);
  const playerHand = roomHands?.get(ws.clientId);

  if (!playerHand) {
    return sendToClient(ws, "ERROR", { message: "You don't have that card." });
  }

  const cardsToPlay: Card[] = [];
  for (const cardId of cardsId) {
    const card = playerHand.cards.find((c) => c.id === cardId);
    if (!card) {
      return sendToClient(ws, "ERROR", {
        message: `You don't have the card with ID: ${cardId}`,
      });
    }
    cardsToPlay.push(card);
  }

  log(`Player ${ws.clientUsername} is playing card(s) ${cardsToPlay}.`);

  cardsToPlay.forEach((card) => {
    playerHand.cards = playerHand.cards.filter((c) => c.id !== card.id);
  });

  if (playerHand.cards.length === 0) {
    playerHand.isInactive = true;
    log(`Player ${ws.clientUsername} is now inactive (no cards left).`);
  }

  room.game.lastPlayedCard = [...cardsToPlay];
  room.game.lastPlayerId = ws.clientId;
  room.game.playedCards.push(...cardsToPlay);

  broadcastRoomState(room);
  advanceTurn(room);
}

export function handleCallBluff(ws: CustomWebSocket): void {
  const roomCode = ws.currentRoomCode;
  const room = roomCode ? getRoom(roomCode) : undefined;

  if (!room || room.status !== "playing") return;

  const playerIds = Array.from(room.players.keys());
  if (playerIds[room.game.currentPlayerIndex] !== ws.clientId) {
    return sendToClient(ws, "ERROR", {
      message: "It's not your turn to call a bluff.",
    });
  }

  const targetId = room.game.lastPlayerId;
  if (!targetId || !room.game.lastPlayedCard) {
    return sendToClient(ws, "ERROR", {
      message: "There is no play to challenge.",
    });
  }

  const challengerId = ws.clientId;
  const challenger = room.players.get(challengerId);
  const target = room.players.get(targetId);

  if (!challenger || !target) return;

  log(
    `Challenge in room ${room.roomCode}: ${challenger.username} challenges ${target.username}.`
  );

  const playedCards = room.game.lastPlayedCard;
  const requiredType = room.game.currentCardType!;

  const invalidCards: Card[] = [];
  const validCards: Card[] = [];

  playedCards.forEach((card) => {
    if (card.type === requiredType || card.type === "joker") {
      validCards.push(card);
    } else {
      invalidCards.push(card);
    }
  });

  const wasLie = invalidCards.length > 0;
  const punishedPlayerId = wasLie ? targetId : challengerId;
  const punishedPlayer = room.players.get(punishedPlayerId)!; // Safe to use ! because we know the ID is valid
  let message: string;

  const roomHands = getRoomHands(room.roomCode);
  const punishedHand = roomHands?.get(punishedPlayerId);
  if (!punishedHand) return;

  punishedHand.riskLevel += 1;
  const eliminatedOnThisTurn = spinRoulette(punishedHand.riskLevel);

  if (wasLie) {
    message = `${target.username} was caught bluffing! `;
  } else {
    message = `${challenger.username} falsely accused ${target.username}! `;
  }

  message += ` ${punishedPlayer.username} spins the roulette...`;

  if (eliminatedOnThisTurn) {
    punishedHand.isEliminated = true;
    message += ` *BANG!*... and has been ELIMINATED!`;
  } else {
    message += ` *CLICK*... and survives. Their risk is now ${punishedHand.riskLevel}/6.`;
  }

  broadcastToRoom(room, "CHALLENGE_RESULT", {
    wasLie,
    punishedPlayerId,
    punishedPlayerName: punishedPlayer.username,
    targetName: target.username,
    revealedCard: playedCards,
    invalidCards: invalidCards,
    validCards: validCards,
    message,
    isEliminated: eliminatedOnThisTurn,
    newRiskLevel: punishedHand.riskLevel,
  });

  setTimeout(() => {
    if (checkForWinner(room)) {
      return;
    }

    redistributeCards(room);

    const punishedPlayerIsChallenger = punishedPlayerId === challengerId;
    const challengerWasEliminated =
      punishedPlayerIsChallenger && eliminatedOnThisTurn;

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

    const nextRoundCardType =
      validCards.length > 0 ? validCards[0].type : undefined;
    startNewRound(room, nextTurnPlayerId, false, nextRoundCardType);
  }, 7000); // Increased delay to match frontend animation
}

function startNewRound(
  room: Room & { game: CardGame },
  startingPlayerId: string,
  isFirstRound: boolean = false,
  newCardType?: CardType
) {
  if (!isFirstRound) {
    log(`Starting new round in room ${room.roomCode}.`);
    room.game.roundNumber += 1;
  }

  let referenceType = newCardType;
  if (referenceType === "joker" || !referenceType) {
    let newReferenceCard: Card | undefined;
    do {
      newReferenceCard = room.game.deck.pop();
    } while (newReferenceCard && newReferenceCard.type === "joker");

    if (!newReferenceCard) {
      log(`Deck is out of non-joker cards. Checking for winner.`);
      checkForWinner(room);
      return;
    }
    referenceType = newReferenceCard.type;
  }

  room.game.currentCardType = referenceType as Exclude<CardType, "joker">;
  room.game.lastPlayedCard = [];
  room.game.lastPlayerId = null;
  room.game.playedCards = [];

  broadcastRoomState(room);
  startPlayerTurn(room, startingPlayerId);
}

function checkForWinner(room: Room & { game: CardGame }): boolean {
  const roomHands = getRoomHands(room.roomCode);
  if (!roomHands) return false;

  const allPlayerIds = Array.from(room.players.keys());
  let winnerId: string | null = null;
  let winnerMessage: string = "";

 for (const [playerId, hand] of roomHands.entries()) {
    const player = room.players.get(playerId);
    if (player && hand.cards.length === 0 && !hand.isEliminated && !hand.isInactive) {
      hand.isInactive = true;
      log(`Player ${player.username} is now inactive (no cards left).`);
    }
  }

  // ✅ VERIFICAR: Se todos os jogadores não eliminados estão inativos
  const nonEliminatedPlayers = allPlayerIds.filter(id => {
    const hand = roomHands.get(id);
    return hand && !hand.isEliminated;
  });

  const activePlayers = nonEliminatedPlayers.filter(id => {
    const hand = roomHands.get(id);
    return hand && !hand.isInactive;
  });

  // ✅ NOVA LÓGICA: Se todos estão inativos, nova rodada
  if (nonEliminatedPlayers.length > 1 && activePlayers.length === 0) {
    log(`All players are inactive. Starting new round.`);
    
    // Redistribuir cartas e reativar jogadores
    redistributeCards(room);
    
    // Reativar todos os jogadores não eliminados
    roomHands.forEach((hand, playerId) => {
      if (!hand.isEliminated) {
        hand.isInactive = false;
      }
    });
    
    // Iniciar nova rodada
    const firstActivePlayer = nonEliminatedPlayers[0];
    startNewRound(room, firstActivePlayer, false);
    return false; // Não terminar o jogo
  }

  // ✅ VITÓRIA: Apenas 1 jogador não eliminado
  if (nonEliminatedPlayers.length <= 1) {
    winnerId = nonEliminatedPlayers[0] || null;
    if (winnerId) {
      const winner = room.players.get(winnerId);
      winnerMessage = `${winner?.username} is the last one standing!`;
    } else {
      winnerMessage = "It's a draw! No one survived.";
    }
  }

  if (winnerId) {
    const winner = winnerId !== "draw" ? room.players.get(winnerId) : null;
    log(
      `Game over in room ${room.roomCode}. Winner: ${
        winner?.username || "Draw"
      }`
    );

    updatePlayerStatsAfterGame(allPlayerIds, winnerId);

    room.status = "waiting";
    room.game.phase = "finished";

    broadcastToRoom(room, "GAME_FINISHED", {
      winnerId,
      winnerName: winner?.username || "Draw",
      message: winnerMessage,
    });
    return true;
  }

  return false;
}

function handleTurnTimeout(
  room: Room & { game: CardGame },
  playerId: string
): void {
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
        message: `${player.username} was eliminated by the roulette for taking too long!`,
      });
    }
  }

  if (checkForWinner(room)) return;

  broadcastRoomState(room);
  advanceTurnAfterInterruption(room);
}

// No game-logic.ts, adicionar esta função:
function redistributeCards(room: Room & { game: CardGame }): void {
  log(`Redistributing cards in room ${room.roomCode}.`);

  const roomHands = getRoomHands(room.roomCode);
  if (!roomHands) return;

  // ✅ Reutilizar dealCards - ela já cria novo deck e distribui 5 cartas
  const newHands = dealCards(room);

  // ✅ Manter apenas dados dos jogadores ativos (não eliminados)
  roomHands.forEach((existingHand, playerId) => {
    const newHand = newHands.get(playerId);
    if (newHand && !existingHand.isEliminated) {
      // Manter dados do jogador, mas trocar apenas as cartas
      existingHand.cards = newHand.cards;
      existingHand.hasPlayedThisTurn = false;
    } else if (existingHand.isEliminated) {
      // Jogadores eliminados não recebem cartas
      existingHand.cards = [];
    }
  });

  // ✅ O deck já foi atualizado pela função dealCards
  // ✅ Limpar cartas jogadas
  room.game.playedCards = [];

  log(
    `Cards redistributed using dealCards. Remaining deck: ${room.game.deck.length}`
  );
}
