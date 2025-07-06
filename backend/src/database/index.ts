import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a new connection pool to the PostgreSQL database.
// The pool manages multiple client connections for better performance.
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Function to create the users table if it doesn't exist.
// This is useful for development but for production, a migration tool is recommended.
export const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        -- Novas colunas adicionadas
        avatar_url VARCHAR(255) DEFAULT NULL,
        matches_played INT DEFAULT 0,
        wins INT DEFAULT 0,
        successful_bluffs INT DEFAULT 0,
        lies_called INT DEFAULT 0,
        times_caught_lying INT DEFAULT 0
      );
    `);
    console.log('Database initialized and "users" table is ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
};

export default pool;