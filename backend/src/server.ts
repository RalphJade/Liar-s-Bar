import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser'; // Imports middleware to parse cookies from incoming requests

import authRouter from './routes/auth.routes';
import userRouter from './routes/user.routes';
import { initializeDatabase } from './database';

dotenv.config();

// Initialize the Express application
const app = express();
const server = http.createServer(app); // Crie o servidor HTTP
const PORT = process.env.PORT || 3001;

// --- Middlewares ---

// Configure Cross-Origin Resource Sharing (CORS)
// 'credentials: true' is essential for allowing the browser to send cookies
// across different origins (e.g., from frontend at port 5174 to backend at 3001).
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5174",
    credentials: true,
  })
);

// Add the cookie-parser middleware to parse cookies attached to the client request object.
app.use(cookieParser());

// Add middleware to parse incoming JSON requests.
app.use(express.json());

// --- API Routes ---

// Mount the authentication routes under the /api/auth path.
app.use("/api/auth", authRouter);
// Mount the user-related routes under the /api/users path.
app.use("/api/users", userRouter);
// Mount the lobby-related routes unde the /api/lobby path
app.use("/api/lobby", lobbyRouter);

// A simple health check endpoint to verify that the server is running.
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});


// --- Server Initialization ---

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

initializeGameService(wss);

server.on(
  "upgrade",
  async (
    request: http.IncomingMessage,
    socket: stream.Duplex,
    head: Buffer
  ) => {
    const pathname = request.url ? parse(request.url).pathname : "";

    const wsPathRegex = /^\/ws\/([a-zA-Z0-9]+)$/;

    const match = pathname?.match(wsPathRegex);


    if (!match) {
      socket.destroy();
      return;
    }
    const roomCode = match[1];

    const cookies = cookie.parse(request.headers.cookie || "");
    const tokenFromCookie = cookies.token;

    const clientData = verifyTokenForWebSocket(tokenFromCookie);


    if (!clientData) {
      log("Falha na autenticação WebSocket: Token inválido ou ausente.");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      // TypeScript precisa de um casting aqui para adicionar propriedades customizadas
      const customWs = ws as CustomWebSocket;
      customWs.clientId = clientData.id;
      customWs.clientUsername = clientData.username;

      log("Handshake WebSocket bem-sucedido. Cliente autenticado.", {
        ws: customWs,
      });
      wss.emit("connection", customWs, request, roomCode);
    });
  }
);

// Start the server and listen for incoming requests on the specified port.
// Also, initialize the database schema upon server startup.
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  initializeDatabase();
});
