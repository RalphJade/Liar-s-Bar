# Liar's Bar

A robust and scalable full-stack multiplayer card game application built with modern web technologies. This project features a high-stakes bluffing card game, "Liar's Bar," with complete user authentication, real-time multiplayer gameplay, and comprehensive game mechanics including Russian Roulette punishment system.

## 🎮 Game Overview

**Liar's Bar** is a deadly game of deception where players must bluff their way to survival. The objective is simple: be the last person standing. Players take turns playing cards face-down, claiming they match the required type for the round. Other players can challenge these claims, and when caught lying (or falsely accused), players face Russian Roulette as punishment.

### Game Mechanics
- **4-player multiplayer** card game with real-time synchronization
- **Bluffing system** with challenge mechanics
- **Roulette punishment** system with escalating risk levels
- **Dynamic card redistribution** when hands are empty
- **Turn-based gameplay** with countdown timers
- **Race condition protection** for card plays and challenges

## ✨ Features

### 🔐 Authentication & Security
- **Secure User Authentication**: Complete registration and login flow
- **JWT-based Security**: Session management using secure, `httpOnly` cookies
- **Password Hashing**: Salted and hashed using `bcryptjs`, never stored in plaintext
- **Route Protection**: Prevents access to game features while in active sessions

### 🎲 Multiplayer Game Engine
- **Real-time WebSocket Communication**: Instant game state synchronization
- **Room System**: Create and join game rooms with optional passwords
- **Live Player Management**: Real-time player join/leave handling
- **Turn Management**: Automated turn progression with timeout protection
- **Game State Persistence**: Robust state management across connections

### 🃏 Card Game Logic
- **Professional Card Engine**: Aces, Kings, Queens, and Jokers
- **Intelligent Fallback System**: Handles disconnections and edge cases
- **Race Condition Protection**: Multiple layers of validation
- **Hand Versioning**: Prevents conflicts during card redistribution
- **Challenge System**: Call bluffs with immediate punishment resolution

### 🎯 User Experience
- **Player Profiles**: Dedicated profile pages with avatars
- **Avatar Uploads**: Secure image upload and storage
- **Responsive Design**: Works seamlessly across devices
- **Interactive UI**: Modern, game-focused interface design
- **Real-time Chat**: In-lobby communication system

### 🏗️ Architecture
- **Decoupled Architecture**: Clear separation between API and client
- **Lightweight Frontend**: Vanilla TypeScript SPA with Vite
- **Robust Validation**: Schema-based validation using Zod
- **Docker Support**: Complete containerization with nginx
- **Production Ready**: SSL/TLS support with Let's Encrypt

## 🛠️ Tech Stack

| Area              | Technology                                                                                        |
| :---------------- | :-----------------------------------------------------------------------------------              |
| **Backend**       | Node.js, Express, TypeScript, PostgreSQL, JWT, Bcrypt.js, Zod, CORS, Multer, **WebSockets (ws)**  |
| **Frontend**      | **Vite, Vanilla TypeScript, CSS Custom Properties, WebSocket Client**                             |
| **Database**      | PostgreSQL with optimized schemas for users, rooms, and game state                                |
| **Real-time**     | **WebSocket-based multiplayer communication**                                                     |
| **DevOps**        | **Docker, Docker Compose, Nginx, Let's Encrypt SSL**                                              |
| **Development**   | Git, GitFlow, Conventional Commits, TypeScript strict mode                                        |

## 📂 Project Structure

This project is structured as a monorepo with a complete multiplayer game architecture:

```
/
├── backend/                    # Node.js Game Server & REST API
│   ├── src/
│   │   ├── controllers/        # Auth, User, Lobby controllers
│   │   ├── services/           # Game logic, Room management, Card engine
│   │   ├── models/             # TypeScript interfaces and schemas
│   │   ├── routes/             # Express route definitions
│   │   ├── middlewares/        # Authentication and validation
│   │   ├── database/           # PostgreSQL connection and schemas
│   │   ├── utils/              # WebSocket utilities and helpers
│   │   └── server.ts           # Main application entry point
│   ├── uploads/                # User-uploaded avatars (ignored by Git)
│   └── Dockerfile              # Backend containerization
├── frontend/                   # Vanilla TS + Vite Client Application
│   ├── src/
│   │   ├── views/              # Page components (Auth, Lobby, Game, Profile)
│   │   ├── components/         # Reusable UI components (Header, etc.)
│   │   ├── services/           # Game logic, API communication
│   │   ├── auth/               # Authentication management
│   │   ├── lobby/              # WebSocket connection handling
│   │   ├── router/             # SPA routing with game state detection
│   │   ├── types/              # TypeScript interfaces
│   │   └── styles/             # CSS styling
│   └── Dockerfile              # Frontend containerization
├── certbot/                    # Let's Encrypt SSL certificates
├── docker-compose.yml          # Multi-container orchestration
├── nginx.conf                  # Reverse proxy configuration
└── README.md
```

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing.

### 📋 Prerequisites

Make sure you have the following tools installed on your system:

- [Node.js](https://nodejs.org/) (v20.x or higher is recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- [PostgreSQL](https://www.postgresql.org/) (v12+ running as a service)
- [Git](https://git-scm.com/)
- [Docker & Docker Compose](https://www.docker.com/) (optional, for containerized deployment)

### ⚙️ Installation & Setup

#### 1. Clone the Repository

First, clone this repository to your local machine.

```bash
git clone <your-github-repo-url>
cd <project-folder-name>

2. Configure the Database (PostgreSQL)
You need to create a dedicated user and database for the application. Connect to PostgreSQL as a superuser (e.g., postgres).

psql -U postgres
Use code with caution.

Run the following SQL commands:

-- Create a new user for the application. Replace 'mysecretpassword' with a strong password.
CREATE USER app_user WITH PASSWORD 'mysecretpassword';

-- Create the database.
CREATE DATABASE auth_app;

-- Grant all privileges on the new database to the new user.
GRANT ALL PRIVILEGES ON DATABASE auth_app TO app_user;

-- Connect to the new database to enable extensions
\c auth_app

-- Enable the pgcrypto extension required for UUID generation.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Exit psql
\q


Note: The application server will automatically create the required database tables (users, rooms, game_state) with the correct schema on its first run.

3. Configure Environment Variables
The backend requires a .env file with credentials and secrets. Navigate to the backend directory and create a .env file by copying the example file.

cd backend
cp .env.example .env
Use code with caution.

Open the newly created backend/.env file and fill in the required values:

```env
# Application Port
PORT=3001

# Database Connection
DB_HOST=postgres
DB_PORT=5432
DB_USER=app_user
DB_PASSWORD=mysecretpassword
DB_NAME=auth_app

# JWT Secret - Use a long, random, and strong string for this!
JWT_SECRET=a_very_strong_and_long_secret_key_for_jwt_that_is_not_this_one
JWT_EXPIRES_IN=1d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5174
```


4. Install Dependencies
You'll need to install dependencies for both the backend and frontend.
For the Backend:

# Navigate to the backend directory
cd backend

# Install all dependencies from package.json
npm install

For the Frontend:

# Navigate to the frontend directory (from the root folder)
cd frontend

# Install all dependencies from package.json
npm install


🏃 Running the Application
You'll need two separate terminal windows to run the backend and frontend concurrently.
Terminal 1: Start the Backend Server

# Navigate to the backend directory
cd backend

# Start the development server
npm run dev


The backend API will now be running on http://localhost:3001. The server will also create the users table in the database if it doesn't exist and the uploads folder for avatars.
Terminal 2: Start the Frontend Client

# Navigate to the frontend directory (from the root folder)
cd frontend

# Start the Vite development server
npm run dev

The frontend application will now be running on http://localhost:5174.

You can now open your browser and navigate to http://localhost:5174 to use the application!

## 🐳 Docker Deployment

For production deployment or easy local setup, you can use Docker Compose:

### Quick Start with Docker

1. **Clone and Configure**:
```bash
git clone <your-github-repo-url>
cd <project-folder-name>
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

2. **Run with Docker Compose**:
```bash
docker-compose up -d
```

This will start:
- **PostgreSQL database** on port 5432
- **Backend API** on port 3001  
- **Frontend application** on port 5174
- **Nginx reverse proxy** on port 80/443

### Production Deployment

For production with SSL:

1. **Configure domain in docker-compose.yml**
2. **Set up environment variables**
3. **Deploy**:
```bash
docker-compose -f docker-compose.yml up -d
```

The application will be available at your domain with automatic SSL via Let's Encrypt.

## 🎮 How to Play

1. **Register/Login** to create your account
2. **Create a Room** or **Join an existing room** from the lobby
3. **Wait for players** (2-4 players required)
4. **Play your cards** face-down, claiming they match the required type
5. **Challenge other players** if you think they're bluffing
6. **Face the consequences** - losers play Russian Roulette
7. **Survive to win** - be the last player standing!

### Game Rules Summary

- **Deck**: Aces, Kings, Queens, and 2 Jokers
- **Jokers are wild** - always count as valid cards
- **Challenge system** - call out suspected bluffs
- **Russian Roulette punishment** with escalating risk levels
- **Turn timer** - 30 seconds per turn or face automatic punishment
- **Last player standing wins**

## 🔧 Advanced Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | 3001 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_USER` | Database user | app_user |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | auth_app |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Token expiration | 1d |
| `FRONTEND_URL` | Frontend URL (CORS) | http://localhost:5174 |

### Database Schema

The application automatically creates these tables:
- **users**: User accounts with authentication
- **rooms**: Game room management
- **game_state**: Persistent game state storage

## 🛡️ Security Features

- **HTTP-only JWT cookies** for session management
- **CORS protection** with whitelist
- **Input validation** with Zod schemas
- **SQL injection prevention** with parameterized queries
- **XSS protection** with proper sanitization
- **Rate limiting** on authentication endpoints
- **Secure file uploads** with type validation

## 🚀 Performance Optimizations

- **WebSocket connection pooling** for multiplayer
- **Efficient game state management** with minimal updates
- **Race condition protection** for concurrent card plays
- **Optimized database queries** with proper indexing
- **Frontend bundling** with Vite for fast loading
- **Docker multi-stage builds** for production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License
This project is licensed under the MIT License. See the LICENSE file for details.


```
