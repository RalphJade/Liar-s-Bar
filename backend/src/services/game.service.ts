import { WebSocket } from "ws";
import {
  Room,
  Participant,
  RoomStateForApi,
  ClientMessage,
  ServerMessage,
  Choice,
} from "../models/types.model";
import { enterRoom } from "./lobby.service";
import { EnterRoomInput } from "../models/lobby.model";

export class CustomWebSocket extends WebSocket {
  clientId!: string;
  clientUsername!: string;
  currentRoomCode!: string;
}

const roomGlobal = new Map<string, Room>();
const userConnections = new Map<number, CustomWebSocket>();

export function sendToClient<T extends ServerMessage["type"]>(
  ws: CustomWebSocket,
  type: T,
  payload: Extract<ServerMessage, { type: T }>["payload"]
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    console.log("Tentativa de envio para um WebSocket fechado.", {
      ws,
      data: { type, payload },
    });
    return;
  }
  const message = { type, payload };
  ws.send(JSON.stringify(message));
  console.log(`Mensagem enviada para o cliente.`, { ws, data: message });
}

export async function handlePlayerConnect(
  ws: CustomWebSocket,
  input: EnterRoomInput
): Promise<void> {
  const { roomCode, password } = input;

  const room = await enterRoom({ roomCode, password });

  if (!room) {
    console.log(`Tentativa de conexão com sala inexistente: ${roomCode}`, { ws });
    sendToClient(ws, "ERROR", {
      message: "Sala não encontrada ou já foi fechada.",
    });
    ws.close();
    return;
  }
}

export function initializeGameService(wss: WebSocket.Server<typeof CustomWebSocket>): void {
  wss.on("connection", (ws: CustomWebSocket, request: any, roomCode: string) => {
    log(`Nova conexão WebSocket para a sala ${roomCode}.`, { ws });
    
    userConnections.set(ws.clientId, ws);
    ws.currentRoomCode = roomCode.toUpperCase();

    handlePlayerConnect(ws);

    ws.on("message", (message) => {
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
