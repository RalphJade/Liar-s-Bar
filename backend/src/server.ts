import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser'; // Imports middleware to parse cookies from incoming requests

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import path from 'path'; // Importe o módulo 'path' do Node.js


import authRouter from './routes/auth.routes';
import userRouter from './routes/user.routes';
import lobbyRouter from './routes/lobby.routes'
import { initializeDatabase } from './database';
import * as lobbyService from './services/lobby.service'; 

dotenv.config();

// Initialize the Express application
const app = express();
const server = http.createServer(app); // Crie o servidor HTTP
const PORT = process.env.PORT || 3001;

// --- Middlewares ---

// Configure Cross-Origin Resource Sharing (CORS)
// 'credentials: true' is essential for allowing the browser to send cookies
// across different origins (e.g., from frontend at port 5174 to backend at 3001).
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5174',
  credentials: true,
}));

// Add the cookie-parser middleware to parse cookies attached to the client request object.
app.use(cookieParser());

// Add middleware to parse incoming JSON requests.
app.use(express.json());

// --- Static File Serving ---
// Servir arquivos estáticos da pasta 'uploads'. Qualquer requisição para /uploads/...
// será servida a partir da pasta 'backend/uploads'.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));


// --- API Routes ---

// Mount the authentication routes under the /api/auth path.
app.use('/api/auth', authRouter);
// Mount the user-related routes under the /api/users path.
app.use('/api/users', userRouter);
// Mount the lobby-related routes unde the /api/lobby path
app.use('/api/lobby', lobbyRouter);

// A simple health check endpoint to verify that the server is running.
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const cookies = request.headers.cookie;
  if (!cookies) {
    socket.destroy();
    return;
  }

  // Extrai o token do cookie
  const token = cookies.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];

  if (!token) {
    socket.destroy();
    return;
  }

  try {
    // Verifica o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string, username: string };
    
    // Completa o handshake
    wss.handleUpgrade(request, socket, head, (ws) => {
      // Anexa os dados do usuário ao objeto ws. É seguro usar type assertion aqui.
      const authenticatedWs = ws as (WebSocket & { userId: string, username: string });
      authenticatedWs.userId = decoded.id;
      authenticatedWs.username = decoded.username;
      
      wss.emit('connection', authenticatedWs, request);
    });
  } catch (err) {
    socket.destroy();
  }
});

// Lógica de Conexão Estabelecida
wss.on('connection', (ws: WebSocket & { userId: string, username: string }) => {
  // Passa a conexão para o nosso serviço de lobby
  lobbyService.handleNewConnection(ws);

  ws.on('message', (messageBuffer) => {
    try {
      const message = JSON.parse(messageBuffer.toString());
      // Direciona a mensagem para o handler apropriado
      if (message.type === 'CHAT_MESSAGE') {
        lobbyService.handleChatMessage(ws, message.payload);
      }
      // Aqui você pode adicionar outros tipos de mensagem (ex: CRIAR_SALA)
    } catch (error) {
      console.error('Mensagem WebSocket mal formatada:', messageBuffer.toString());
    }
  });

  ws.on('close', () => {
    // Passa a desconexão para o nosso serviço de lobby
    lobbyService.handleDisconnect(ws);
  });
});

// --- Server Initialization ---

// Start the server and listen for incoming requests on the specified port.
// Also, initialize the database schema upon server startup.
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🚀 Redis is running on http://localhost:${process.env.REDIS_PORT}`)
  console.log(`🚀 Server (HTTP & WebSocket) is running on http://localhost:${PORT}`);
  initializeDatabase();
});