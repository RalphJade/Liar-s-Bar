import {pool} from '../database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RegisterUserInput, LoginUserInput } from '../models/user.model';

// Service layer for handling user registration business logic.
export const registerUser = async (input: RegisterUserInput) => {
  const { username, email, password } = input;

  // Check if user with the same email or username already exists.
  const existingUser = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]);
  if (existingUser.rows.length > 0) {
    throw new Error('User with this email or username already exists.');
  }

  // Hash the password before storing it.
  const hashedPassword = await bcrypt.hash(password, 12);

  // Insert the new user into the database.
  // Note: We are not returning stats here as they are all default 0.
  const newUser = await pool.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
    [username, email, hashedPassword]
  );

  return newUser.rows[0];
};


// Service layer for handling user login business logic.
export const loginUser = async (input: LoginUserInput) => {
  const { email, password } = input;

  // Find the user by email.
  const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (user.rows.length === 0) {
    throw new Error('Invalid credentials.');
  }

  const foundUser = user.rows[0];

  // Compare the provided password with the stored hashed password.
  const isPasswordValid = await bcrypt.compare(password, foundUser.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials.');
  }
  
  // Prepare user data to be sent back, excluding the password hash.
  const userPayload = {
    id: foundUser.id,
    username: foundUser.username,
    email: foundUser.email,
    avatar_url: foundUser.avatar_url,
    matches_played: foundUser.matches_played,
    wins: foundUser.wins,
    successful_bluffs: foundUser.successful_bluffs,
    lies_called: foundUser.lies_called,
    times_caught_lying: foundUser.times_caught_lying,
  };


  // Generate a JWT token for the authenticated user.
  const token = jwt.sign(
    { id: foundUser.id, username: foundUser.username, email: foundUser.email, avatar_url: foundUser.avatar_url }, // Include avatar_url in the token payload
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

  return { token, user: userPayload };
};