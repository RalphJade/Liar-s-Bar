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
const PORT = process.env.PORT || 3001;

// --- Middlewares ---

// Configure Cross-Origin Resource Sharing (CORS)
// 'credentials: true' is essential for allowing the browser to send cookies
// across different origins (e.g., from frontend at port 5173 to backend at 3001).
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Add the cookie-parser middleware to parse cookies attached to the client request object.
app.use(cookieParser());

// Add middleware to parse incoming JSON requests.
app.use(express.json());


// --- API Routes ---

// Mount the authentication routes under the /api/auth path.
app.use('/api/auth', authRouter);
// Mount the user-related routes under the /api/users path.
app.use('/api/users', userRouter);

// A simple health check endpoint to verify that the server is running.
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});


// --- Server Initialization ---

// Start the server and listen for incoming requests on the specified port.
// Also, initialize the database schema upon server startup.
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  initializeDatabase();
});