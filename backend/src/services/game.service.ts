import { WebSocket, Server as WebSocketServer } from "ws";
import {
  Room,
  RoomStateForApi,
  ClientMessage,
  ServerMessage,
  GamePhase,
  Card,
  CardType,
  PlayerHand
} from "../models/types.model";
import { enterRoom } from "./lobby.service";
import { log } from "../utils/logger";

export interface CustomWebSocket extends WebSocket {
  clientId: string;
  clientUsername: string;
  currentRoomCode: string;
}

interface CardGame {
  deck: Card[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  phase: GamePhase;
  roundNumber: number;
  turnTimeLimit: number;
  turnTimer: NodeJS.Timeout | null;
  currentCardType: CardType | null;
  playedCards: Card[];  // ← Mudado de GameCard[] para Card[]
}

const roomGlobal = new Map<string, Room & { game: CardGame }>();
const userConnections = new Map<string, CustomWebSocket>();
const playerHands = new Map<string, Map<string, PlayerHand>>(); // roomCode -> playerId -> hand

// Configurações do jogo
const MAX_PLAYERS = 4;
const CARDS_PER_PLAYER = 5;
const TURN_TIME_LIMIT = 30000; // 30 segundos por turno
const CARDS_PER_TYPE = 6; // 6 cartas de cada tipo (rei, dama, ás)
const JOKERS_COUNT = 2; // 2 coringas

export function sendToClient<T extends ServerMessage["type"]>(
  ws: CustomWebSocket,
  type: T,
  payload: Extract<ServerMessage, { type: T }>["payload"]
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    log("Tentativa de envio para um WebSocket fechado.", {
      ws,
      data: { type }
    });
    return;
  }
  const message = { type, payload };
  ws.send(JSON.stringify(message));
  log(`Mensagem enviada para ${ws.clientUsername}: ${type}`);
}

// Função para criar deck específico do jogo
function createSpecialDeck(): Card[] {
  const deck: Card[] = [];
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
  const cardTypes: CardType[] = ['king', 'queen', 'ace'];

  // Adiciona 6 cartas de cada tipo (rei, dama, ás) - distribui pelos naipes
  cardTypes.forEach(type => {
    for (let i = 0; i < CARDS_PER_TYPE; i++) {
      const suitIndex = i % suits.length;
      const cardNumber = Math.floor(i / suits.length) + 1;
      deck.push({
        id: `${type}_${suits[suitIndex]}_${cardNumber}`,
        type,
        suit: suits[suitIndex]
      });
    }
  });

  // Adiciona 2 coringas
  for (let i = 0; i < JOKERS_COUNT; i++) {
    deck.push({
      id: `joker_${i + 1}`,
      type: 'joker'
    });
  }

  // Embaralhar deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Função para distribuir cartas
function dealCards(room: Room & { game: CardGame }): void {
  const deck = createSpecialDeck();
  const roomHands = new Map<string, PlayerHand>();

  // Distribui 5 cartas para cada jogador
  Array.from(room.players.keys()).forEach((playerId, index) => {
    const playerCards = deck.splice(0, CARDS_PER_PLAYER);
    roomHands.set(playerId, {
      cards: playerCards,
      hasPlayedThisTurn: false,
      isReady: false,
      score: 0,
    });
  });

  // Cartas restantes ficam no deck
  room.game.deck = deck;
  
  playerHands.set(room.roomCode, roomHands);
  log(`Cartas distribuídas na sala ${room.roomCode}. Deck restante: ${deck.length} cartas.`);
}

// Função para verificar se uma carta pode ser jogada
function canPlayCard(card: Card, currentCardType: CardType | null): boolean {
  // Primeira carta da rodada pode ser qualquer uma
  if (!currentCardType) return true;
  
  // Coringa pode ser jogado como qualquer tipo
  if (card.type === 'joker') return true;
  
  // Carta deve ser do mesmo tipo que está sendo jogado
  return card.type === currentCardType;
}

// Função para obter o próximo jogador
function getNextPlayer(room: Room & { game: CardGame }): string | null {
  const playerIds = Array.from(room.players.keys());
  const currentIndex = room.game.currentPlayerIndex;
  const nextIndex = (currentIndex + room.game.direction + playerIds.length) % playerIds.length;
  
  room.game.currentPlayerIndex = nextIndex;
  return playerIds[nextIndex];
}

async function handlePlayerJoinRoom(ws: CustomWebSocket, roomCode: string): Promise<void> {
  const room = await enterRoom({ roomCode, password: "" });
  
  if (!room) {
    log(`Tentativa de conexão com sala inexistente: ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "Sala não encontrada ou já foi fechada.",
    });
    ws.close();
    return;
  }

  await addPlayerToRoom(ws, room);
  sendToClient(ws, "JOINED_ROOM", { roomCode });
  broadcastRoomState(room);
}

async function addPlayerToRoom(ws: CustomWebSocket, room: Room): Promise<void> {
  const { clientId, clientUsername } = ws;
  
  if (isUserInAnyRoom(clientId)) {
    log(`Usuário ${clientUsername} tentou entrar na sala ${room.roomCode} mas já está em outra.`, { ws });
    sendToClient(ws, "ERROR", { 
      message: "Você já está em outra sala. Saia da sala atual para poder entrar em uma nova." 
    });
    ws.close();
    return;
  }

  if (!roomGlobal.has(room.roomCode)) {
    roomGlobal.set(room.roomCode, {
      ...room,
      players: new Map(),
      spectators: new Map(),
      game: {
        deck: [],
        currentPlayerIndex: 0,
        direction: 1,
        phase: 'waiting',
        roundNumber: 0,
        turnTimeLimit: TURN_TIME_LIMIT,
        turnTimer: null,
        currentCardType: null,
        playedCards: [],
      },
    });
  }

  const localRoom = roomGlobal.get(room.roomCode)!;
  let participant = localRoom.players.get(clientId) || localRoom.spectators.get(clientId);
  
  if (participant) {
    // Reconexão
    participant.ws = ws;
    log(`Participante ${clientUsername} reconectado à sala ${room.roomCode}.`, { ws });
    
    if (localRoom.players.has(clientId)) {
      broadcastToOthers(localRoom, ws, "PLAYER_RECONNECTED", {
        playerId: clientId,
        playerName: clientUsername,
        message: `${clientUsername} reconectou-se!`
      });
    }
  } else {
    // Nova entrada
    if (localRoom.players.size < MAX_PLAYERS) {
      localRoom.players.set(clientId, { username: clientUsername, ws });
      log(`Jogador ${clientUsername} entrou na sala ${room.roomCode} (${localRoom.players.size}/${MAX_PLAYERS}).`, { ws });
      
      // Verifica se pode iniciar o jogo
      if (localRoom.players.size === MAX_PLAYERS) {
        startCardGame(localRoom);
      } else {
        // Notifica que precisa de mais jogadores
        broadcastToRoom(localRoom, "WAITING_FOR_PLAYERS", {
          currentPlayers: localRoom.players.size,
          maxPlayers: MAX_PLAYERS,
          message: `Aguardando jogadores (${localRoom.players.size}/${MAX_PLAYERS})`,
          playersNeeded: MAX_PLAYERS - localRoom.players.size
        });
      }
    } else {
      // Adiciona como espectador
      localRoom.spectators.set(clientId, { username: clientUsername, ws });
      log(`Espectador ${clientUsername} entrou na sala ${room.roomCode}.`, { ws });
    }
  }
}

function startCardGame(room: Room & { game: CardGame }): void {
  log(`Iniciando jogo de cartas na sala ${room.roomCode} com ${room.players.size} jogadores.`);
  
  room.status = "playing";
  room.game.phase = "playing";
  room.game.roundNumber = 1;
  room.game.currentPlayerIndex = 0;
  room.game.currentCardType = null;
  room.game.playedCards = [];
  
  // Distribui cartas
  dealCards(room);
  
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
  const roomHands = playerHands.get(room.roomCode);
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

function startPlayerTurn(room: Room & { game: CardGame }, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player?.ws) return;

  log(`Turno do jogador ${player.username} na sala ${room.roomCode}.`);
  
  // Cancela timer anterior se existir
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
  }
  
  // Verifica se todas as cartas foram jogadas nesta rodada
  const allPlayersPlayed = Array.from(room.players.keys()).every(pId => {
    const roomHands = playerHands.get(room.roomCode);
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

function startNewRound(room: Room & { game: CardGame }): void {
  log(`Iniciando nova rodada na sala ${room.roomCode}.`);
  
  // Reset da rodada
  room.game.currentCardType = null;
  room.game.playedCards = [];
  room.game.roundNumber++;
  
  // Reset dos flags de jogada
  const roomHands = playerHands.get(room.roomCode);
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
  const roomHands = playerHands.get(room.roomCode);
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

function attemptPlayerReconnection(ws: CustomWebSocket): boolean {
  for (const room of roomGlobal.values()) {
    const participant = room.players.get(ws.clientId) || room.spectators.get(ws.clientId);
    
    if (participant && !participant.ws) {
      log(`Reconectando ${ws.clientUsername} à sala ${room.roomCode}.`, { ws });
      
      participant.ws = ws;
      ws.currentRoomCode = room.roomCode;
      
      // Envia estado da sala
      const roomState = getRoomStateForApi(room, ws.clientId);
      sendToClient(ws, "ROOM_STATE_UPDATE", roomState);
      
      // Envia cartas se for jogador
      if (room.players.has(ws.clientId)) {
        const roomHands = playerHands.get(room.roomCode);
        const playerHand = roomHands?.get(ws.clientId);
        
        if (playerHand) {
          sendToClient(ws, "HAND_UPDATE", {
            cards: playerHand.cards,
            handSize: playerHand.cards.length,
            currentCardType: room.game.currentCardType
          });
        }
        
        broadcastToOthers(room, ws, "PLAYER_RECONNECTED", {
          playerId: ws.clientId,
          playerName: ws.clientUsername,
          message: `${ws.clientUsername} reconectou-se!`
        });
      }
      
      return true;
    }
  }
  return false;
}

function broadcastRoomState(room: Room & { game: CardGame }): void {
  log(`Transmitindo estado da sala ${room.roomCode} para todos os participantes.`);
  const allParticipants = [...room.players.values(), ...room.spectators.values()];

  allParticipants.forEach((participant) => {
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      const personalRoomState = getRoomStateForApi(room, participant.ws.clientId);
      sendToClient(participant.ws, "ROOM_STATE_UPDATE", personalRoomState);
    }
  });
}

function broadcastToRoom<T extends ServerMessage["type"]>(
  room: Room & { game: CardGame },
  type: T,
  payload: Extract<ServerMessage, { type: T }>["payload"]
): void {
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(participant => {
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
      sendToClient(participant.ws, type, payload);
    }
  });
}

function broadcastToOthers<T extends ServerMessage["type"]>(
  room: Room & { game: CardGame },
  excludeWs: CustomWebSocket,
  type: T,
  payload: Extract<ServerMessage, { type: T }>["payload"]
): void {
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(participant => {
    if (participant.ws && participant.ws.readyState === WebSocket.OPEN && participant.ws.clientId !== excludeWs.clientId) {
      sendToClient(participant.ws, type, payload);
    }
  });
}

export function initializeGameService(wss: WebSocketServer): void {
  wss.on("connection", (ws: CustomWebSocket, request: any, roomCode: string) => {
    log(`Nova conexão WebSocket para a sala ${roomCode}.`, { ws });

    userConnections.set(ws.clientId, ws);
    ws.currentRoomCode = roomCode.toUpperCase();

    const reconnected = attemptPlayerReconnection(ws);
    
    if (!reconnected) {
      handlePlayerJoinRoom(ws, roomCode);
    }

    ws.on("message", async (message) => {
      try {
        const data: ClientMessage = JSON.parse(message.toString());
        log("Mensagem recebida.", { ws, data });
        
        handleClientMessage(ws, data);
      } catch (error: any) {
        log("Erro ao parsear mensagem JSON.", { ws, data: { error: error.message, originalMessage: message.toString() } });
      }
    });

    ws.on("close", () => {
      log("Cliente desconectado.", { ws });
      userConnections.delete(ws.clientId);
      handlePlayerDisconnect(ws);
    });

    ws.on("error", (error) => {
      log("Erro no WebSocket.", { ws, data: { error: error.message } });
    });
  });
}

function handleClientMessage(ws: CustomWebSocket, data: ClientMessage): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) {
    return sendToClient(ws, "ERROR", { message: "Você não está em uma sala ativa." });
  }

  const isPlayer = room.players.has(ws.clientId);
  if (!isPlayer && !room.spectators.has(ws.clientId)) {
    return sendToClient(ws, "ERROR", { message: "Você não é um participante desta sala." });
  }

  switch (data.type) {
    case "PLAY_CARD":
      if (isPlayer) handlePlayCard(ws, data.payload);
      else sendToClient(ws, "ERROR", { message: "Espectadores não podem jogar cartas." });
      break;
    case "CLOSE_ROOM":
      if (isPlayer && room.ownerId === ws.clientId) handleCloseRoom(ws);
      else sendToClient(ws, "ERROR", { message: "Apenas o dono da sala pode fechá-la." });
      break;
    case "READY_FOR_NEXT_GAME":
      if (isPlayer) handleReadyForNextGame(ws);
      else sendToClient(ws, "ERROR", { message: "Espectadores não podem ficar prontos." });
      break;
    case "CHALLENGE_PLAYER":
      if (isPlayer) handleChallengePlayer(ws, data.payload);
      else sendToClient(ws, "ERROR", { message: "Espectadores não podem desafiar outros jogadores." });
      break;
    default:
      sendToClient(ws, "ERROR", { message: `Tipo de mensagem desconhecido: ${data.type}` });
  }
}

function handlePlayCard(ws: CustomWebSocket, payload: { cardId: string; declaredType?: CardType }): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  const { cardId, declaredType } = payload;
  const roomHands = playerHands.get(room.roomCode);
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

  // Notifica outros jogadores
  broadcastToOthers(room, ws, "OPPONENT_PLAYED_CARD", {
    playerId: ws.clientId,
    playerName: ws.clientUsername,
    cardType: displayType,
    handSize: playerHand.cards.length,
    currentCardType: room.game.currentCardType,
    isJoker: isJoker
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

function handleChallengePlayer(ws: CustomWebSocket, payload: { targetPlayerId: string }): void {
  const room = roomGlobal.get(ws.currentRoomCode);
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
  const roomHands = playerHands.get(room.roomCode);
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

function prepareNextGame(room: Room & { game: CardGame }): void {
  room.game.phase = "waiting";
  
  // Resetar hands
  const roomHands = playerHands.get(room.roomCode);
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

function handleReadyForNextGame(ws: CustomWebSocket): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  const roomHands = playerHands.get(room.roomCode);
  const playerHand = roomHands?.get(ws.clientId);
  
  if (!playerHand) return;

  playerHand.isReady = true;
  
  // Verifica se todos estão prontos
  const allReady = Array.from(room.players.keys()).every(playerId => {
    const hand = roomHands?.get(playerId);
    return hand?.isReady === true;
  });

  if (allReady) {
    startCardGame(room);
  } else {
    const readyCount = Array.from(room.players.keys()).filter(playerId => {
      const hand = roomHands?.get(playerId);
      return hand?.isReady === true;
    }).length;

    broadcastToRoom(room, "PLAYERS_READY_UPDATE", {
      readyCount,
      totalPlayers: room.players.size,
      message: `${readyCount}/${room.players.size} jogadores prontos`
    });
  }
}

function isUserInAnyRoom(userId: string): boolean {
  for (const room of roomGlobal.values()) {
    if (room.players.has(userId) || room.spectators.has(userId)) {
      return true;
    }
  }
  return false;
}

function handlePlayerDisconnect(ws: CustomWebSocket): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  if (room.spectators.has(ws.clientId)) {
    log(`Espectador ${ws.clientUsername} saiu da sala ${room.roomCode}.`, { ws });
    room.spectators.delete(ws.clientId);
    broadcastRoomState(room);
    return;
  }

  const participant = room.players.get(ws.clientId);
  if (participant) {
    participant.ws = null;
    log(`Jogador ${ws.clientUsername} desconectou da sala ${room.roomCode}.`, { ws });

    // Cancela timer se era a vez do jogador desconectado
    const currentPlayerId = Array.from(room.players.keys())[room.game.currentPlayerIndex];
    if (currentPlayerId === ws.clientId && room.game.turnTimer) {
      clearTimeout(room.game.turnTimer);
      room.game.turnTimer = null;
      
      // Passa para o próximo jogador
      const nextPlayerId = getNextPlayer(room);
      if (nextPlayerId) {
        startPlayerTurn(room, nextPlayerId);
      }
    }

    broadcastToOthers(room, ws, "PLAYER_DISCONNECTED", {
      playerId: ws.clientId,
      playerName: ws.clientUsername,
      message: `${ws.clientUsername} se desconectou.`,
    });

    broadcastRoomState(room);
  }
}

function handleCloseRoom(ws: CustomWebSocket): void {
  const room = roomGlobal.get(ws.currentRoomCode);
  if (!room) return;

  log(`Sala ${room.roomCode} está sendo fechada pelo dono ${ws.clientUsername}.`, { ws });
  
  // Cancela timer se existir
  if (room.game.turnTimer) {
    clearTimeout(room.game.turnTimer);
  }
  
  const closePayload = { message: `A sala ${room.roomCode} foi fechada pelo dono.` };
  
  const allParticipants = [...room.players.values(), ...room.spectators.values()];
  allParticipants.forEach(p => {
    if (p.ws) {
      sendToClient(p.ws, "ROOM_CLOSED", closePayload);
      p.ws.currentRoomCode = "";
    }
  });

  // Remove mãos dos jogadores
  playerHands.delete(room.roomCode);
  roomGlobal.delete(room.roomCode);
}

function getRoomStateForApi(room: Room & { game: CardGame }, currentUserId: string): RoomStateForApi {
  const roomHands = playerHands.get(room.roomCode);
  const currentPlayerHand = roomHands?.get(currentUserId);
  
  return {
    roomCode: room.roomCode,
    ownerId: room.ownerId,
    players: Array.from(room.players.entries()).map(([id, p]) => ({
      id,
      username: p.username,
      isOnline: p.ws !== null,
      handSize: roomHands?.get(id)?.cards.length || 0,
      isReady: roomHands?.get(id)?.isReady || false,
      hasPlayedThisTurn: roomHands?.get(id)?.hasPlayedThisTurn || false,
      score: roomHands?.get(id)?.score || 0,
    })),
    spectators: Array.from(room.spectators.entries()).map(([id, s]) => ({ 
      id, 
      username: s.username 
    })),
    status: room.status,
    game: {
      phase: room.game.phase,
      currentPlayerIndex: room.game.currentPlayerIndex,
      currentPlayerId: Array.from(room.players.keys())[room.game.currentPlayerIndex],
      currentCardType: room.game.currentCardType,
      roundNumber: room.game.roundNumber,
      direction: room.game.direction,
      playedCardsCount: room.game.playedCards.length,
      deckSize: room.game.deck.length,
    },
    myCards: currentPlayerHand?.cards || [],
    myHandSize: currentPlayerHand?.cards.length || 0,
  };
}

// Exports
export {
  roomGlobal,
  playerHands,
};