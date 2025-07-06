import { CustomWebSocket } from "../services/game.service"; // Forward declaration

// The payload decoded from the JWT
export interface JwtPayload {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

// Player choices (mantido para compatibilidade)
export type Choice = "rock" | "paper" | "scissors";

// === NOVOS TIPOS PARA JOGO DE CARTAS ===

// Tipos específicos para o jogo de cartas
export type CardType = "king" | "queen" | "ace" | "joker";
export type CardSuit = "hearts" | "diamonds" | "clubs" | "spades";
export type GamePhase = "waiting" | "playing" | "finished" | "paused";

// Interface para cartas do jogo
export interface Card {
  id: string;
  type: CardType;
  suit?: CardSuit; // Opcional porque coringas não têm naipe
}

// Interface para a mão de cada jogador
export interface PlayerHand {
  cards: Card[];
  hasPlayedThisTurn: boolean;
  isReady: boolean;
  score: number;
}

// Interface para o estado do jogo de cartas
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
}

// Represents a participant (player or spectator)
export interface Participant {
  username: string;
  ws: CustomWebSocket | null; // The active WebSocket connection
}

// The main Room object (extendido para suportar jogo de cartas)
export interface Room {
  roomCode: string;
  ownerId: string;
  players: Map<string, Participant>; // Map<userId, Participant>
  spectators: Map<string, Participant>; // Map<userId, Participant>
  status: "waiting" | "playing";
  choices: Map<string, Choice>; // Map<userId, Choice> - mantido para compatibilidade
  password?: string; // Optional password for the room
}

// Data structure for the API response about a room's state (extendido)
export interface RoomStateForApi {
  roomCode: string;
  ownerId: string;
  players: {
    id: string;
    username: string;
    isOnline: boolean;
    handSize?: number; // Novo: para jogo de cartas
    hasPlayedThisTurn?: boolean; // Novo: para jogo de cartas
    score?: number; // Novo: para jogo de cartas
    isReady?: boolean; // Novo: para jogo de cartas
  }[];
  spectators: { id: string; username: string }[];
  status: Room["status"];
  myChoice: Choice | null; // Mantido para compatibilidade

  // Novos campos para jogo de cartas
  game?: {
    phase: GamePhase;
    currentPlayerIndex: number;
    currentPlayerId: string | null;
    currentCardType: CardType | null;
    roundNumber: number;
    direction: 1 | -1;
    playedCardsCount: number;
    deckSize: number;
  };
  myCards?: Card[];
  myHandSize?: number;
}

// === TIPOS AUXILIARES PARA JOGO DE CARTAS ===

export interface GameRules {
  cardsPerPlayer: number;
  cardTypes: CardType[];
  cardsPerType: number;
  jokersCount: number;
  maxPlayers: number;
  turnTimeLimit: number;
}

export interface FinalHandInfo {
  playerId: string;
  playerName: string;
  cardsLeft: number;
  score: number;
  finalCards?: Card[];
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  score: number;
  gamesWon?: number;
  gamesPlayed?: number;
}

// === CONSTANTES DO JOGO ===

export const GAME_CONSTANTS = {
  MAX_PLAYERS: 4,
  CARDS_PER_PLAYER: 5,
  CARDS_PER_TYPE: 6,
  JOKERS_COUNT: 2,
  TURN_TIME_LIMIT: 30000,
} as const;

// --- WebSocket Message Types ---

// Messages sent FROM the Client TO the Server (extendido)
export type ClientMessage =
  | {
      type: "MAKE_CHOICE";
      payload: { choice: Choice };
    }
  | {
      type: "CLOSE_ROOM";
      payload: { message: string };
    }
  | {
      type: "ENTER_ROOM";
      payload: {}; // No payload needed
    }
  | {
      type: "ENTER_ROOM";
      payload: { roomCode: string; password?: string };
    }
  | {
      type: "CREATE_ROOM";
      payload: { roomName: string; password?: string };
    }
  | {
      type: "LEAVE_ROOM";
      payload: {}; // No payload needed
    }
  | {
      type: "RECONNECT";
      payload: {}; // No payload needed
    }
  | {
      type: "JOIN_ROOM";
      payload: { roomCode: string; password?: string };
    }
  | {
      type: "DISCONNECT";
      payload: {}; // No payload needed
    }
  | {
      type: "REQUEST_ROOM_STATE";
      payload: {}; // No payload needed
    }
  | {
      type: "REQUEST_ROOM_CODE";
      payload: {}; // No payload needed
    }
  | {
      type: "REQUEST_ROOM_PLAYERS";
      payload: {}; // No payload needed
    }
  | {
      type: "REQUEST_ROOM_SPECTATORS";
      payload: {}; // No payload needed
    }
  // === NOVAS MENSAGENS PARA JOGO DE CARTAS ===
  | {
      type: "PLAY_CARD";
      payload: { cardId: string; declaredType?: CardType };
    }
  | {
      type: "DRAW_CARD";
      payload: {};
    }
  | {
      type: "CHALLENGE_PLAYER";
      payload: { targetPlayerId: string };
    }
  | {
      type: "READY_FOR_NEXT_GAME";
      payload: {};
    }
  | {
      type: "CHAT_MESSAGE";
      payload: { message: string };
    };

// Messages sent FROM the Server TO the Client (extendido)
export type ServerMessage =
  | {
      type: "ROOM_CREATED";
      payload: {
        roomCode: string;
        ownerId: string;
        players: { id: string; username: string; isOnline: boolean }[];
        spectators: { id: string; username: string }[];
        status: "waiting" | "playing";
        message: string;
        maxPlayers: number;
        currentPlayers: number;
        playersNeeded: number;
      };
    }
  | {
      type: "JOINED_ROOM";
      payload: { roomCode: string; asSpectator: boolean; message: string };
    }
  | {
      type: "ERROR";
      payload: { message: string };
    }
  | {
      type: "ROOM_STATE_UPDATE";
      payload: RoomStateForApi;
    }
  | {
      type: "CHOICE_MADE";
      payload: { choice: Choice };
    }
  | {
      type: "OPPONENT_CHOICE_MADE";
      payload: { message: string };
    }
  | {
      type: "GAME_RESULT";
      payload: {
        choices: { [key: number]: Choice };
        winnerId: string | null;
        players: { [key: number]: string };
      };
    }
  | {
      type: "NEW_ROUND";
      payload: {
        message: string;
        roundNumber: number;
        currentPlayer: string | null;
      };
    }
  | {
      type: "ROOM_CLOSED";
      payload: { message: string };
    }
  | {
      type: "OPPONENT_DISCONNECTED";
      payload: { username: string; message: string };
    }
  | {
      type: "OPPONENT_RECONNECTED";
      payload: RoomStateForApi & { message: string };
    }
  | {
      type: "JOINED_ROOM";
      payload: { roomCode: string };
    }
  // === NOVAS MENSAGENS PARA JOGO DE CARTAS ===
  | {
      type: "WAITING_FOR_PLAYERS";
      payload: {
        currentPlayers: number;
        maxPlayers: number;
        message: string;
        playersNeeded: number;
      };
    }
  | {
      type: "GAME_STARTED";
      payload: {
        message: string;
        currentPlayer: string;
        roundNumber: number;
        gameRules: GameRules;
      };
    }
  | {
      type: "GAME_FINISHED";
      payload: {
        winnerId: string;
        winnerName: string;
        message: string;
        roundNumber: number;
        finalHands: FinalHandInfo[];
      };
    }
  | {
      type: "NEXT_GAME_READY";
      payload: {
        message: string;
        scores: PlayerScore[];
      };
    }
  | {
      type: "YOUR_TURN";
      payload: {
        message: string;
        timeLimit: number;
        currentCardType: CardType | null;
        isFirstPlay: boolean;
      };
    }
  | {
      type: "PLAYER_TURN";
      payload: {
        currentPlayer: string;
        playerName: string;
        message: string;
        timeLimit: number;
        currentCardType: CardType | null;
      };
    }
  | {
      type: "TURN_TIMEOUT";
      payload: { message: string };
    }
  | {
      type: "PLAYER_TIMEOUT";
      payload: {
        playerId: string;
        playerName: string;
        message: string;
      };
    }
  | {
      type: "HAND_DEALT";
      payload: {
        cards: Card[];
        handSize: number;
        totalCards: number;
      };
    }
  | {
      type: "HAND_UPDATE";
      payload: {
        cards: Card[];
        handSize: number;
        currentCardType: CardType | null;
      };
    }
  | {
      type: "CARD_PLAYED";
      payload: {
        card: Card;
        handSize: number;
        declaredType?: CardType;
        currentCardType: CardType | null;
      };
    }
  | {
      type: "CARD_DRAWN";
      payload: {
        card: Card;
        handSize: number;
      };
    }
  | {
      type: "OPPONENT_PLAYED_CARD";
      payload: {
        playerId: string;
        playerName: string;
        cardType: CardType;
        handSize: number;
        currentCardType: CardType | null;
        isJoker: boolean;
      };
    }
  | {
      type: "PLAYER_CHALLENGED";
      payload: {
        challengerId: string;
        challengerName: string;
        targetId: string;
        targetName: string;
        message: string;
      };
    }
  | {
      type: "CHALLENGE_RESULT";
      payload: {
        challengerId: string;
        targetId: string;
        success: boolean;
        message: string;
        revealedCards: Card[];
      };
    }
  | {
      type: "PLAYERS_READY_UPDATE";
      payload: {
        readyCount: number;
        totalPlayers: number;
        message: string;
      };
    }
  | {
      type: "CHAT_BROADCAST";
      payload: {
        author: string;
        message: string;
        timestamp: Date;
      };
    }
  | {
      type: "PLAYER_RECONNECTED";
      payload: {
        playerId: string;
        playerName: string;
        message: string;
      };
    }
  | {
      type: "PLAYER_DISCONNECTED";
      payload: {
        playerId: string;
        playerName: string;
        message: string;
      };
    };
