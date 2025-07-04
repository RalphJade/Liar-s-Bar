import { CustomWebSocket } from "../services/game.service";

interface LogContext {
  ws?: CustomWebSocket;
  clientId?: number;
  clientUsername?: string;
  data?: any;
}

/**
 * Função de log centralizada para o servidor.
 * @param message - A mensagem principal a ser logada.
 * @param context - Informações contextuais opcionais.
 */
export function log(message: string, context: LogContext = {}): void {
  const timestamp = new Date().toLocaleTimeString();
  let contextString = "";

  const parts: string[] = [];
  const clientUsername = context.ws?.clientUsername ?? context.clientUsername;
  const clientId = context.ws?.clientId ?? context.clientId;
  const currentRoomCode = context.ws?.currentRoomCode;

  if (clientUsername) parts.push(`User: ${clientUsername}`);
  if (clientId) parts.push(`ID: ${clientId}`);
  if (currentRoomCode) parts.push(`Room: ${currentRoomCode}`);

  if (parts.length > 0) {
    contextString = ` [${parts.join(", ")}]`;
  }

  console.log(`${timestamp} - ${message}${contextString}`);

  if (context.data) {
    console.log("  └─ Data:", JSON.stringify(context.data, null, 2));
  }
}