import pool from '../database';

// Finds a user by their ID and returns all their data.
export const findUserById = async (id: string) => {
  const result = await pool.query('SELECT id, username, email, avatar_url, matches_played, wins, successful_bluffs, lies_called, times_caught_lying FROM users WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
};

// Updates the avatar_url for a given user.
export const updateUserAvatar = async (id: string, avatarUrl: string) => {
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, id]);
  // Return the fully updated user data
  return findUserById(id);
};