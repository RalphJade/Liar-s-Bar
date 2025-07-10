import { Card, CardType, PlayerHand, Room, GamePhase } from '../models/types.model';
import { log } from '../utils/logger';
import { CARDS_PER_PLAYER, CARDS_PER_TYPE, JOKERS_COUNT } from '../config/game.config';

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
  lastPlayedCard: Card[];
  lastPlayerId: string | null;
}

/**
 * Creates a specialized deck for the Liar's Bar game.
 * @returns {Card[]} A shuffled array of cards.
 */
function createSpecialDeck(): Card[] {
  const deck: Card[] = [];
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
  const cardTypes: CardType[] = ['king', 'queen', 'jack'];

  // Add 6 cards of each specified type, distributing among suits
  cardTypes.forEach(type => {
    for (let i = 0; i < CARDS_PER_TYPE; i++) {
      const suitIndex = i % suits.length;
      const cardNumber = Math.floor(i / suits.length) + 1; // Used to make the ID unique
      deck.push({
        id: `${type}_${suits[suitIndex]}_${cardNumber}`,
        type,
        suit: suits[suitIndex]
      });
    }
  });

  // Add 2 Jokers
  for (let i = 0; i < JOKERS_COUNT; i++) {
    deck.push({
      id: `ace_${i + 1}`,
      type: 'ace'
    });
  }

  // Shuffle the deck (Fisher-Yates algorithm)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * Deals cards to all players in a room from a new deck.
 * @param {Room & { game: CardGame }} room - The game room object.
 * @returns {Map<string, PlayerHand>} A map of player IDs to their new hands.
 */
export function dealCards(room: Room & { game: CardGame }): Map<string, PlayerHand> {
  const deck = createSpecialDeck();
  const roomHands = new Map<string, PlayerHand>();

  const playerIds = Array.from(room.players.keys());

  playerIds.forEach(playerId => {
    const hand = deck.splice(0, CARDS_PER_PLAYER);
    roomHands.set(playerId, {
      cards: hand,
      hasPlayedThisTurn: false,
      isReady: false,
      score: 0, // Score can be kept from previous games or reset
      riskLevel: 0, // Reset risk at the start of a new game
      isEliminated: false,
    });
  });

  // The remaining cards form the draw pile for this game
  room.game.deck = deck;
  
  log(`Cards dealt in room ${room.roomCode}. Deck has ${deck.length} cards remaining.`);
  return roomHands;
}

/**
 * Checks if a played card is valid according to the current round's card type.
 * @param {Card} card - The card being played.
 * @param {CardType | null} currentCardType - The required card type for the round.
 * @returns {boolean} True if the play is valid, false otherwise.
 */
export function canPlayCard(card: Card, currentCardType: CardType | null): boolean {
  // If it's the first card of the round, any card is valid.
  if (currentCardType === null) return true;
  
  // A joker can always be played.
  if (card.type === 'ace') return true;
  
  // The played card's type must match the round's required type.
  return card.type === currentCardType;
}

export {
  createSpecialDeck
};