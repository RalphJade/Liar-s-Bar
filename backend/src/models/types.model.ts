import WebSocket from "ws";

// The payload decoded from the JWT
export interface JwtPayload {
  userId: number; 
  username: string;
  iat: number;
  exp: number;
}

export interface CustomWebSocket extends WebSocket {
  clientId: string;
  clientUsername: string;
  currentRoomCode?: string;
}

// Player choices (maintained for compatibility)
export type Choice = "rock" | "paper" | "scissors";

// === NEW TYPES FOR CARD GAME ===

// Tipos específicos para o jogo de cartas
export type CardType = "king" | "queen" | "jack" | "ace";
export type CardSuit = "hearts" | "diamonds" | "clubs" | "spades";
export type GamePhase = "waiting" | "playing" | "challenge" | "finished" | "paused";

export interface Card {
  id: string;
  type: CardType;
  suit?: CardSuit; 
}

export interface PlayerHand {
  cards: Card[];
  hasPlayedThisTurn: boolean;
  isReady: boolean;
  score: number;
  riskLevel: number; 
  isEliminated: boolean;
}

export interface CardGame {
  deck: Card[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  phase: GamePhase;
  roundNumber: number;
  turnTimeLimit: number;
  turnTimer: NodeJS.Timeout | null;
  currentCardType: CardType | null; 
  playedCards: Card[]; 
  lastPlayedCard: Card | null; 
  lastPlayerId: string | null;
}

export interface Participant {
  username: string;
  ws: CustomWebSocket | null;
  disconnectionTimer?: NodeJS.Timeout;
}

export interface Room {
  roomName: string; 
  roomCode: string;
  ownerId: string;
  players: Map<string, Participant>; 
  spectators: Map<string, Participant>; 
  status: "waiting" | "playing";
  choices: Map<string, Choice>; 
  password?: string; 
}

export interface RoomStateForApi {
  roomCode: string;
  ownerId: string;
  players: {
    id: string;
    username: string;
    isOnline: boolean;
    avatar_url: string | null;
    handSize?: number; 
    hasPlayedThisTurn?: boolean; 
    score?: number; 
    isReady?: boolean; 
    riskLevel?: number; 
    isEliminated?: boolean;
  }[];
  spectators: { id: string; username: string }[];
  status: Room["status"];
  myChoice: Choice | null; 

  game?: {
    phase: GamePhase;
    currentPlayerIndex: number;
    currentPlayerId: string | null;
    currentCardType: CardType | null;
    roundNumber: number;
    direction: 1 | -1;
    playedCardsCount: number;
    deckSize: number;
    lastPlayerId: string | null;
  };
  myCards?: Card[];
  myHandSize?: number;
}

export interface GameRules {
  cardsPerPlayer: number;
  cardTypes: CardType[];
  cardsPerType: number;
  jokersCount: number;
  maxPlayers: number;
  turnTimeLimit: number;
}

export interface ChatMessage {
    userId: string;
    username: string;
    text: string;
    timestamp: string;
}

export type ClientMessage =
  | { type: "LIST_ROOMS"; payload: {} }
  | { type: "CREATE_ROOM"; payload: { roomName: string; password?: string } }
  | { type: "JOIN_ROOM"; payload: { roomCode: string; password?: string } }
  | { type: "LEAVE_ROOM"; payload: {} }
  | { type: "PLAY_CARD"; payload: { cardId: string } }
  | { type: "CALL_BLUFF"; payload: {} }
  | { type: "READY_FOR_NEXT_GAME"; payload: {} }
  | { type: "CHAT_MESSAGE"; payload: { message: string } };

export type ServerMessage =
  | { type: "PLAYER_LEFT"; payload: { playerId: string; playerName: string; message: string; currentPlayers: number; }; }
  | { type: "LEFT_ROOM"; payload: { message: string }; }
  | { type: "WAITING_ROOMS"; payload: { rooms: { code: string; name: string; currentPlayers: number; maxPlayers: number; hasPassword: boolean; }[]; }; }
  | { type: "ROOM_CREATED"; payload: { code: string, name: string, currentPlayers: number, maxPlayers: number, hasPassword: boolean, ownerId: string, }; }
  | { type: "JOINED_ROOM"; payload: { roomCode: string; asSpectator: boolean; message: string }; }
  | { type: "ERROR"; payload: { message: string }; }
  | { type: "ROOM_STATE_UPDATE"; payload: RoomStateForApi; }
  | { type: "ROOM_CLOSED"; payload: { code: string, name: string }; }
  | { type: "WAITING_FOR_PLAYERS"; payload: { currentPlayers: number; maxPlayers: number; message: string; playersNeeded: number; }; }
  | { type: "GAME_STARTED"; payload: { message: string; currentPlayerId: string; players: RoomStateForApi['players']; gameRules: GameRules; }; }
  | { type: "GAME_FINISHED"; payload: { winnerId: string; winnerName: string; message: string; }; }
  | { type: "YOUR_TURN"; payload: { message: string; timeLimit: number; currentCardType: CardType | null; canChallenge: boolean; }; }
  | { type: "PLAYER_TURN"; payload: { currentPlayerId: string; playerName: string; message: string; currentCardType: CardType | null; }; }
  | { type: "TURN_TIMEOUT"; payload: { message: string }; }
  | { type: "PLAYER_TIMEOUT"; payload: { playerId: string; playerName: string; message: string; }; }
  | { type: "HAND_DEALT"; payload: { cards: Card[]; handSize: number; }; }
  | { type: "CARD_PLAYED_CONFIRMATION"; payload: { cardId: string; handSize: number; message: string; }; }
  | { type: "CHAT_BROADCAST"; payload: { authorId: string; authorName: string; message: string; timestamp: string; }; }
  | { type: "PLAYER_DISCONNECTED"; payload: { playerId: string; playerName: string; message: string; }; }
  | { type: "CHALLENGE_RESULT"; payload: { wasLie: boolean; punishedPlayerId: string; punishedPlayerName: string; revealedCard: Card; message: string; isEliminated: boolean; newRiskLevel: number; }; }
  | { type: "PLAYER_ELIMINATED"; payload: { playerId: string; playerName: string; message: string; }; };