import { Card, CardType, PlayerHand, Room, GamePhase } from '../models/types.model';
import { log } from '../utils/logger';

export interface CardGame {
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

// Configurações do jogo
const MAX_PLAYERS = 4;
const CARDS_PER_PLAYER = 5;
const TURN_TIME_LIMIT = 30000; // 30 segundos por turno
const CARDS_PER_TYPE = 6; // 6 cartas de cada tipo (rei, dama, ás)
const JOKERS_COUNT = 2; // 2 coringas

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
function dealCards(room: Room & { game: CardGame }): Map<string, PlayerHand> {
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
  
  log(`Cartas distribuídas na sala ${room.roomCode}. Deck restante: ${deck.length} cartas.`);
  return roomHands
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

export {
  createSpecialDeck, dealCards, canPlayCard
};