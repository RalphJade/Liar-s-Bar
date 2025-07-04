import { CustomWebSocket } from "../services/game.service"; // Forward declaration

// The payload decoded from the JWT
export interface JwtPayload {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

// Player choices
export type Choice = "rock" | "paper" | "scissors";

// Represents a participant (player or spectator)
export interface Participant {
  username: string;
  ws: CustomWebSocket | null; // The active WebSocket connection
}

// The main Room object
export interface Room {
  roomCode: string;
  ownerId: string;
  players: Map<string, Participant>; // Map<userId, Participant>
  spectators: Map<string, Participant>; // Map<userId, Participant>
  status: "waiting" | "playing";
  choices: Map<string, Choice>; // Map<userId, Choice>
}

// Data structure for the API response about a room's state
export interface RoomStateForApi {
  roomCode: string;
  ownerId: string;
  players: { id: string; username: string; isOnline: boolean }[]; // Changed: Added isOnline
  spectators: { id: string; username: string }[];
  status: Room["status"];
  myChoice: Choice | null;
}

// --- WebSocket Message Types ---

// Messages sent FROM the Client TO the Server
export type ClientMessage =
  | {
      type: "MAKE_CHOICE";
      payload: { choice: Choice };
    }
  |{
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

// Messages sent FROM the Server TO the Client (discriminated union)
export type ServerMessage =
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
      payload: { message: string };
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