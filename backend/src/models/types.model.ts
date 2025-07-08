import WebSocket from "ws";

// The payload decoded from the JWT
export interface JwtPayload {
  userId: number; // This might be a string (UUID) depending on your DB schema, adjust if needed
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

// Specific types for the card game
export type CardType = "king" | "queen" | "ace" | "joker";
export type CardSuit = "hearts" | "diamonds" | "clubs" | "spades";
export type GamePhase = "waiting" | "playing" | "challenge" | "finished" | "paused";

// Interface for game cards
export interface Card {
  id: string;
  type: CardType;
  suit?: CardSuit; // Optional because jokers don't have a suit
}

// Interface for each player's hand and state
export interface PlayerHand {
  cards: Card[];
  hasPlayedThisTurn: boolean;
  isReady: boolean;
  score: number;
  riskLevel: number; // New: 0-5, represents how many blank slots are left in the roulette
  isEliminated: boolean; // New: To mark if a player is out of the game
}

// Interface for the state of the card game
export interface CardGame {
  deck: Card[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  phase: GamePhase;
  roundNumber: number;
  turnTimeLimit: number;
  turnTimer: NodeJS.Timeout | null;
  currentCardType: CardType | null; // This will now be set at the start of the round
  playedCards: Card[]; // Pile of cards played in the current round
  lastPlayedCard: Card | null; // The very last card played, for challenges
  lastPlayerId: string | null; // The ID of the player who played the last card
}

// Represents a participant (player or spectator)
export interface Participant {
  username: string;
  ws: CustomWebSocket | null; // The active WebSocket connection
}

// The main Room object (extended for card game support)
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

// Data structure for the API response about a room's state (extended)
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

// === AUXILIARY TYPES ===
export interface GameRules {
  cardsPerPlayer: number;
  cardTypes: CardType[];
  cardsPerType: number;
  jokersCount: number;
  maxPlayers: number;
  turnTimeLimit: number;
}

// --- WebSocket Message Types ---

// Messages sent FROM the Client TO the Server
export type ClientMessage =
  | { type: "LIST_ROOMS"; payload: {} }
  | { type: "CREATE_ROOM"; payload: { roomName: string; password?: string } }
  | { type: "JOIN_ROOM"; payload: { roomCode: string; password?: string } }
  | { type: "LEAVE_ROOM"; payload: {} }
  | { type: "PLAY_CARD"; payload: { cardId: string } } // Simplified: no more declaredType
  | { type: "CALL_BLUFF"; payload: {} }
  | { type: "READY_FOR_NEXT_GAME"; payload: {} }
  | { type: "CHAT_MESSAGE"; payload: { message: string } };

// Messages sent FROM the Server TO the Client
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
  | { type: "YOUR_TURN"; payload: { message: string; timeLimit: number; currentCardType: CardType | null; canChallenge: boolean; }; }
  | { type: "PLAYER_TURN"; payload: { currentPlayerId: string; playerName: string; message: string; currentCardType: CardType | null; }; }
  | { type: "HAND_DEALT"; payload: { cards: Card[]; handSize: number; }; }
  | { type: "CARD_PLAYED_CONFIRMATION"; payload: { cardId: string; handSize: number; message: string; }; }
  | { type: "CHAT_BROADCAST"; payload: { authorId: string; authorName: string; message: string; timestamp: string; }; }
  | { type: "PLAYER_DISCONNECTED"; payload: { playerId: string; playerName: string; message: string; }; };