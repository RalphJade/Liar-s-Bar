# Liar`s Bar

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

A robust and scalable full-stack authentication system built with a modern, decoupled architecture. This project serves as a foundational template for secure web applications, featuring a Node.js backend and a lightweight, framework-less frontend built with **Vanilla TypeScript and Vite**.

## ✨ Features

- **Secure User Authentication**: Complete flow for user registration and login.
- **JWT-based Security**: Session management using secure, `httpOnly` cookies containing JSON Web Tokens (JWT).
- **Password Hashing**: User passwords are salted and hashed using `bcryptjs`, never stored in plaintext.
- **Decoupled Architecture**: A clear separation between the backend REST API and the frontend client application.
- **Lightweight Frontend**: A clean, responsive Single-Page Application (SPA) built with **vanilla TypeScript** and styled with plain CSS, all powered by the **Vite** build tool for an incredible development experience.
- **Robust Validation**: Strong, schema-based input validation on the backend using `Zod`.

## 🛠️ Tech Stack

| Area         | Technology                                                          |
| :----------- | :------------------------------------------------------------------ |
| **Backend**  | Node.js, Express, TypeScript, PostgreSQL, JWT, Bcrypt.js, Zod, CORS |
| **Frontend** | **Vite, Vanilla TypeScript, Axios, CSS Custom Properties**          |
| **Database** | PostgreSQL                                                          |
| **DevOps**   | Git, GitFlow (feature branches), Conventional Commits               |

## 📂 Project Structure

This project is structured as a monorepo, containing the backend and frontend in separate packages for clear separation of concerns.
Use code with caution.

/
├── backend/ # Node.js REST API
│ ├── src/
│ └── ...
├── frontend/ # Vanilla TS + Vite Client Application
│ ├── src/
│ └── ...
├── .gitignore
└── README.md

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing.

### 📋 Prerequisites

Make sure you have the following tools installed on your system:

- [Node.js](https://nodejs.org/) (v20.x or higher is recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- [PostgreSQL](https://www.postgresql.org/) (running as a service)
- [Git](https://git-scm.com/)

### ⚙️ Installation & Setup

#### 1. Clone the Repository

First, clone this repository to your local machine.

```bash
git clone <your-github-repo-url>
cd <project-folder-name>

2. Configure the Database (PostgreSQL)
You need to create a dedicated user and database for the application.
Connect to PostgreSQL as a superuser (e.g., postgres).
Generated bash
psql -U postgres

Bash
Run the following SQL commands:
Generated sql
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

SQL
3. Configure Environment Variables
The backend requires a .env file with credentials and secrets.
Navigate to the backend directory and create a .env file by copying the example file.

cd backend
cp .env.example .env

Bash
Open the newly created backend/.env file and fill in the required values.
Generated env
# Application Port
PORT=3001

# Database Connection
DB_HOST=localhost
DB_PORT=5432
DB_USER=app_user
DB_PASSWORD=mysecretpassword
DB_NAME=auth_app

# JWT Secret - Use a long, random, and strong string for this!
JWT_SECRET=a_very_strong_and_long_secret_key_for_jwt_that_is_not_this_one
JWT_EXPIRES_IN=1d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5174

Env
🏃 Running the Application
You'll need two separate terminal windows to run the backend and frontend concurrently.
Terminal 1: Start the Backend Server

# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Start the development server
npm run dev

Bash
The backend API will now be running on http://localhost:3001. The server will also attempt to create the users table in the database if it doesn't exist.
Terminal 2: Start the Frontend Client

# Navigate to the frontend directory (from the root folder)
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev

The frontend application will now be running on http://localhost:5174.
You can now open your browser and navigate to http://localhost:5174 to use the application!

📄 License
This project is licensed under the MIT License. See the LICENSE file for details.
```
