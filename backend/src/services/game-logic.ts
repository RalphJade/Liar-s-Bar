import { setRoomHands, getRoomHands, getRoom } from "./gameState";
import { CardGame, CardType, CustomWebSocket, Room } from "../models/types.model";
import { log } from "../utils/logger";
import { broadcastToRoom, broadcastToOthers, getNextPlayer, sendToClient } from "../utils/websocket.util";
import { dealCards, canPlayCard } from "./cards.service";
import { MAX_PLAYERS, TURN_TIME_LIMIT, CARDS_PER_PLAYER, CARDS_PER_TYPE, JOKERS_COUNT } from "../config/game.config";

export function startCardGame(room: Room & { game: CardGame }): void {
  log(`Iniciando jogo de cartas na sala ${room.roomCode} com ${room.players.size} jogadores.`);
  
  room.status = "playing";
  room.game.phase = "playing";
  room.game.roundNumber = 1;
  room.game.currentPlayerIndex = 0;
  room.game.currentCardType = null;
  room.game.playedCards = [];
  
  // Distribui cartas
  const cards = dealCards(room);
  setRoomHands(room.roomCode, cards);
  
  // Inicia o turno do primeiro jogador
  const firstPlayerId = Array.from(room.players.keys())[0];
  startPlayerTurn(room, firstPlayerId);
  
  // Notifica todos os jogadores
  broadcastToRoom(room, "GAME_STARTED", {
    message: "O jogo começou! O primeiro jogador deve escolher que tipo de carta jogar.",
    currentPlayer: firstPlayerId,
    roundNumber: room.game.roundNumber,
    gameRules: {
      cardsPerPlayer: CARDS_PER_PLAYER,
      cardTypes: ['king', 'queen', 'ace', 'joker'],
      cardsPerType: CARDS_PER_TYPE,
      jokersCount: JOKERS_COUNT,
      maxPlayers: MAX_PLAYERS,
      turnTimeLimit: TURN_TIME_LIMIT
    }
  });
  
  // Envia cartas para cada jogador
  const roomHands = getRoomHands(room.roomCode);
  if (roomHands) {
    room.players.forEach((player, playerId) => {
      const hand = roomHands.get(playerId);
      if (hand && player.ws) {
        sendToClient(player.ws, "HAND_DEALT", {
          cards: hand.cards,
          handSize: hand.cards.length,
          totalCards: CARDS_PER_PLAYER
        });
      }
    });
  }
}

/**
 * NOVA FUNÇÃO: Lida especificamente com a interrupção de um turno.
 * É chamada quando o jogador da vez sai ou o tempo acaba.
 * @param room O objeto da sala.
 */
export function advanceTurnAfterInterruption(room: Room & { game: CardGame }): void {
  log(`Avançando turno na sala ${room.roomCode} devido a uma interrupção.`);
  
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }
  
  // Passa para o próximo jogador
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    // Chama a função interna para iniciar o próximo turno
    startPlayerTurn(room, nextPlayerId);
  } else {
    // Lógica para o caso de não haver próximo jogador (ex: fim do jogo)
    log(`Nenhum jogador seguinte encontrado na sala ${room.roomCode}.`);
  }
}

export function startPlayerTurn(room: Room & { game: CardGame }, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player?.ws) return;

  log(`Turno do jogador ${player.username} na sala ${room.roomCode}.`);
  
  // Cancela timer anterior se existir
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
  }
  
  // Verifica se todas as cartas foram jogadas nesta rodada
  const allPlayersPlayed = Array.from(room.players.keys()).every(pId => {
    const roomHands = getRoomHands(room.roomCode);
    const hand = roomHands?.get(pId);
    return hand?.hasPlayedThisTurn === true;
  });

  if (allPlayersPlayed) {
    // Inicia nova rodada
    startNewRound(room);
    return;
  }
  
  // Notifica o jogador atual
  sendToClient(player.ws, "YOUR_TURN", {
    message: room.game.currentCardType ? 
      `Sua vez! Jogue uma carta do tipo: ${room.game.currentCardType}` : 
      "Sua vez! Escolha que tipo de carta jogar para iniciar a rodada.",
    timeLimit: room.game.turnTimeLimit,
    currentCardType: room.game.currentCardType,
    isFirstPlay: room.game.currentCardType === null
  });
  
  // Notifica outros jogadores
  broadcastToOthers(room, player.ws, "PLAYER_TURN", {
    currentPlayer: playerId,
    playerName: player.username,
    message: `Vez de ${player.username}`,
    timeLimit: room.game.turnTimeLimit,
    currentCardType: room.game.currentCardType
  });
  
  // Inicia timer do turno
  room.game.turnTimer = setTimeout(() => {
    handleTurnTimeout(room, playerId);
  }, room.game.turnTimeLimit);
}

export function handlePlayCard(ws: CustomWebSocket, payload: { cardId: string; declaredType?: CardType }): void {
  const roomCode = ws.currentRoomCode;
  if (!roomCode) {
    sendToClient(ws, "ERROR", { message: "You must be in a room to challenge a player." });
    return;
  }

  const room = getRoom(roomCode);
  if (!room) return;

  const { cardId, declaredType } = payload;
  const roomHands = getRoomHands(room.roomCode);
  const playerHand = roomHands?.get(ws.clientId);

  if (!playerHand) return;

  // Verifica se é a vez do jogador
  const currentPlayerId = Array.from(room.players.keys())[room.game.currentPlayerIndex];
  if (currentPlayerId !== ws.clientId) {
    return sendToClient(ws, "ERROR", { message: "Não é sua vez!" });
  }

  // Verifica se já jogou nesta rodada
  if (playerHand.hasPlayedThisTurn) {
    return sendToClient(ws, "ERROR", { message: "Você já jogou nesta rodada!" });
  }

  // Verifica se a carta existe na mão
  const cardIndex = playerHand.cards.findIndex(card => card.id === cardId);
  if (cardIndex === -1) {
    return sendToClient(ws, "ERROR", { message: "Você não possui esta carta." });
  }

  const card = playerHand.cards[cardIndex];

  // Se é a primeira carta da rodada, define o tipo
  if (room.game.currentCardType === null) {
    if (card.type === 'joker') {
      if (!declaredType || !['king', 'queen', 'ace'].includes(declaredType)) {
        return sendToClient(ws, "ERROR", { 
          message: "Você deve declarar que tipo de carta o coringa representa (king, queen ou ace)." 
        });
      }
      room.game.currentCardType = declaredType;
    } else {
      room.game.currentCardType = card.type;
    }
  }

  // Verifica se a jogada é válida
  if (!canPlayCard(card, room.game.currentCardType)) {
    return sendToClient(ws, "ERROR", { 
      message: `Você deve jogar uma carta do tipo: ${room.game.currentCardType}` 
    });
  }

  // Remove carta da mão
  playerHand.cards.splice(cardIndex, 1);
  playerHand.hasPlayedThisTurn = true;
  
  // Adiciona à pilha de cartas jogadas
  room.game.playedCards.push(card);
  
  // Cancela timer do turno
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }

  const isJoker = card.type === 'joker';
  const displayType = isJoker ? declaredType : card.type;

  log(`Jogador ${ws.clientUsername} jogou carta ${card.type}${isJoker ? ` (declarado como ${declaredType})` : ''}.`, { ws });

  // Envia confirmação para o jogador
  sendToClient(ws, "CARD_PLAYED", {
    card,
    handSize: playerHand.cards.length,
    declaredType: isJoker ? declaredType : undefined,
    currentCardType: room.game.currentCardType
  });

  // Verifica se o jogador ganhou
  if (playerHand.cards.length === 0) {
    handlePlayerWin(room, ws.clientId);
    return;
  }

  // Próximo jogador
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    startPlayerTurn(room, nextPlayerId);
  }
}

export function handleChallengePlayer(ws: CustomWebSocket, payload: { targetPlayerId: string }): void {
  const roomCode = ws.currentRoomCode;

  if (!roomCode) {
    sendToClient(ws, "ERROR", { message: "You must be in a room to challenge a player." });
    return;
  }

  const room = getRoom(roomCode);
  if (!room) return;

  const { targetPlayerId } = payload;
  const challenger = room.players.get(ws.clientId);
  const target = room.players.get(targetPlayerId);

  if (!challenger || !target) {
    return sendToClient(ws, "ERROR", { message: "Jogador não encontrado." });
  }

  // Só pode desafiar se houver cartas jogadas na rodada
  if (room.game.playedCards.length === 0) {
    return sendToClient(ws, "ERROR", { message: "Não há cartas para desafiar." });
  }

  // Lógica do desafio seria implementada aqui
  // Por exemplo, verificar se o jogador jogou a carta certa
  
  broadcastToRoom(room, "PLAYER_CHALLENGED", {
    challengerId: ws.clientId,
    challengerName: challenger.username,
    targetId: targetPlayerId,
    targetName: target.username,
    message: `${challenger.username} desafiou ${target.username}!`
  });
}

function handlePlayerWin(room: Room & { game: CardGame }, winnerId: string): void {
  const winner = room.players.get(winnerId);
  if (!winner) return;

  log(`Jogador ${winner.username} ganhou na sala ${room.roomCode}!`);

  // Cancela timer se existir
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
    room.game.turnTimer = null;
  }

  room.game.phase = "finished";
  room.status = "waiting";

  // Atualiza score
  const roomHands = getRoomHands(room.roomCode);
  const winnerHand = roomHands?.get(winnerId);
  if (winnerHand) {
    winnerHand.score++;
  }

  // Notifica todos os jogadores
  broadcastToRoom(room, "GAME_FINISHED", {
    winnerId,
    winnerName: winner.username,
    message: `${winner.username} ganhou!`,
    roundNumber: room.game.roundNumber,
    finalHands: Array.from(room.players.keys()).map(playerId => ({
      playerId,
      playerName: room.players.get(playerId)?.username || '',
      cardsLeft: roomHands?.get(playerId)?.cards.length || 0,
      score: roomHands?.get(playerId)?.score || 0
    }))
  });

  // Prepara para próximo jogo
  setTimeout(() => {
    prepareNextGame(room);
  }, 10000);
}

function startNewRound(room: Room & { game: CardGame }): void {
  log(`Iniciando nova rodada na sala ${room.roomCode}.`);
  
  // Reset da rodada
  room.game.currentCardType = null;
  room.game.playedCards = [];
  room.game.roundNumber++;
  
  // Reset dos flags de jogada
  const roomHands = getRoomHands(room.roomCode);
  if (roomHands) {
    roomHands.forEach(hand => {
      hand.hasPlayedThisTurn = false;
    });
  }
  
  // Próximo jogador inicia
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    startPlayerTurn(room, nextPlayerId);
  }
  
  broadcastToRoom(room, "NEW_ROUND", {
    message: "Nova rodada iniciada!",
    roundNumber: room.game.roundNumber,
    currentPlayer: nextPlayerId
  });
}

function handleTurnTimeout(room: Room & { game: CardGame }, playerId: string): void {
  log(`Timeout do turno para jogador ${playerId} na sala ${room.roomCode}.`);
  
  const player = room.players.get(playerId);
  if (!player?.ws) return;

  // Marca que o jogador jogou (perdeu a vez)
  const roomHands = getRoomHands(room.roomCode);
  const playerHand = roomHands?.get(playerId);
  if (playerHand) {
    playerHand.hasPlayedThisTurn = true;
  }

  // Notifica timeout
  sendToClient(player.ws, "TURN_TIMEOUT", {
    message: "Tempo esgotado! Você perdeu a vez."
  });
  
  broadcastToOthers(room, player.ws, "PLAYER_TIMEOUT", {
    playerId,
    playerName: player.username,
    message: `${player.username} perdeu a vez por timeout.`
  });
  
  // Passa para o próximo jogador
  const nextPlayerId = getNextPlayer(room);
  if (nextPlayerId) {
    startPlayerTurn(room, nextPlayerId);
  }
}

function prepareNextGame(room: Room & { game: CardGame }): void {
  room.game.phase = "waiting";
  
  // Resetar hands
  const roomHands = getRoomHands(room.roomCode);
  if (roomHands) {
    roomHands.forEach(hand => {
      hand.isReady = false;
      hand.hasPlayedThisTurn = false;
      hand.cards = []; // Limpa cartas para próximo jogo
    });
  }

  broadcastToRoom(room, "NEXT_GAME_READY", {
    message: "Pronto para o próximo jogo? Clique em 'Pronto' quando estiver preparado.",
    scores: Array.from(room.players.keys()).map(playerId => ({
      playerId,
      playerName: room.players.get(playerId)?.username || '',
      score: roomHands?.get(playerId)?.score || 0
    }))
  });
}