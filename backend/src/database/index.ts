// src/database/index.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
import Redis from "ioredis";

dotenv.config();

// Create a new connection to the Redis database.
const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
})

// Create a new connection pool to the PostgreSQL database.
// The pool manages multiple client connections for better performance.
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Function to create the users table if it doesn't exist.
// This is useful for development but for production, a migration tool is recommended.
//It also creates the Redis client
export const initializeDatabase = async () => {
  await redisClient.ping();

  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized and "users" table is ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
};

export {pool, redisClient};