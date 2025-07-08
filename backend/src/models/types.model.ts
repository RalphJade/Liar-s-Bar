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
  currentCardType: CardType | null;
  playedCards: Card[]; // Pile of cards played in the current round
  lastPlayedCard: Card | null; // New: The very last card played, for challenges
  lastPlayerId: string | null; // New: The ID of the player who played the last card
}

// Represents a participant (player or spectator)
export interface Participant {
  username: string;
  ws: CustomWebSocket | null; // The active WebSocket connection
}

// The main Room object (extended for card game support)
export interface Room {
  roomName: string; // New: room name
  roomCode: string;
  ownerId: string;
  players: Map<string, Participant>; // Map<userId, Participant>
  spectators: Map<string, Participant>; // Map<userId, Participant>
  status: "waiting" | "playing";
  choices: Map<string, Choice>; // Map<userId, Choice> - maintained for compatibility
  password?: string; // Optional password for the room
}

// Data structure for the API response about a room's state (extended)
export interface RoomStateForApi {
  roomCode: string;
  ownerId: string;
  players: {
    id: string;
    username: string;
    isOnline: boolean;
    handSize?: number; // New: for card game
    hasPlayedThisTurn?: boolean; // New: for card game
    score?: number; // New: for card game
    isReady?: boolean; // New: for card game
    riskLevel?: number; // New: for roulette
    isEliminated?: boolean; // New: for elimination
  }[];
  spectators: { id: string; username: string }[];
  status: Room["status"];
  myChoice: Choice | null; // Maintained for compatibility

  // New fields for card game
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

// === AUXILIARY TYPES FOR CARD GAME ===

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

// --- WebSocket Message Types ---

// Messages sent FROM the Client TO the Server (extended)
export type ClientMessage =
  | {
      type: "LIST_ROOMS";
      payload: {}; // No payload needed
    }
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
  // === NEW MESSAGES FOR CARD GAME ===
  | {
      type: "PLAY_CARD";
      payload: { cardId: string; declaredType?: CardType }; // Can declare a type for a Joker
    }
  | {
      type: "CALL_BLUFF";
      payload: {}; // No payload needed, the server knows who played last
    }
  | {
      type: "READY_FOR_NEXT_GAME";
      payload: {};
    }
  | {
      type: "CHAT_MESSAGE";
      payload: { message: string };
    };

// Messages sent FROM the Server TO the Client (extended)
export type ServerMessage =
    | {
      type: "PLAYER_LEFT";
      payload: {
        playerId: string;
        playerName: string;
        message: string;
        currentPlayers: number;
      };
    }
    | {
      type: "LEFT_ROOM";
      payload: { message: string };
    }
    | { type: "WAITING_ROOMS";
      payload: {
        rooms: {
          code: string;
          name: string;
          currentPlayers: number;
          maxPlayers: number;
          hasPassword: boolean;
        }[];
      };
    }
  | {
      type: "ROOM_CREATED";
      payload: {
          code: string,
          name: string,
          currentPlayers: number,
          maxPlayers: number,
          hasPassword: boolean,
          ownerId: string, // To identify the creator
        },
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
      type: "NEW_ROUND";
      payload: {
        message: string;
        roundNumber: number;
        currentPlayer: string | null;
      };
    }
  | {
      type: "ROOM_CLOSED";
      payload: { code: string, name: string };
    }
  // === NEW MESSAGES FOR CARD GAME ===
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
        currentPlayerId: string;
        players: RoomStateForApi['players'];
        gameRules: GameRules;
      };
    }
  | {
      type: "GAME_FINISHED";
      payload: {
        winnerId: string;
        winnerName: string;
        message: string;
        finalStats: any; // You can define a detailed type for stats
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
        canChallenge: boolean; // New: Can the player challenge?
      };
    }
  | {
      type: "PLAYER_TURN";
      payload: {
        currentPlayerId: string;
        playerName: string;
        message: string;
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
      };
    }
  | {
      type: "CARD_PLAYED_CONFIRMATION"; // Renamed for clarity
      payload: {
        cardId: string;
        handSize: number;
        message: string;
      };
    }
  | {
      type: "OPPONENT_PLAYED_CARD";
      payload: {
        playerId: string;
        playerName: string;
        handSize: number;
      };
    }
  | {
      type: "CHALLENGE_BROADCAST";
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
        wasLie: boolean;
        punishedPlayerId: string;
        punishedPlayerName: string;
        revealedCard: Card;
        message: string;
        isEliminated: boolean;
        newRiskLevel: number;
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
        authorId: string;
        authorName: string;
        message: string;
        timestamp: string;
      };
    }
  | {
      type: "PLAYER_ELIMINATED";
      payload: {
        playerId: string;
        playerName: string;
        message: string;
      }
    }
  | {
      type: "PLAYER_DISCONNECTED";
      payload: {
        playerId: string;
        playerName: string;
        message: string;
      };
    };