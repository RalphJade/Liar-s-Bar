// /frontend/src/types/game.types.ts

// These types are a copy from the backend, but without Node.js specific imports.
// This is crucial for keeping the frontend and backend environments separate.

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

export interface RoomStateForApi {
  roomCode: string;
  ownerId: string;
  players: {
    id: string;
    username: string;
    isOnline: boolean;
    handSize?: number;
    hasPlayedThisTurn?: boolean;
    score?: number;
    isReady?: boolean;
    riskLevel?: number;
    isEliminated?: boolean;
    isInactive?: boolean;
    avatar_url?: string | null;
    reconnectingUntil?: number | null;
  }[];
  spectators: { id: string; username: string }[];
  status: "waiting" | "playing";
  myChoice?: any | null; // This field seems unused in the card game

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

export interface ChatMessage {
    authorId: string;
    authorName: string;
    message: string;
    timestamp: string;
}