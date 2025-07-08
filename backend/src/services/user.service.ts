import { pool } from '../database';
import fs from 'fs';
import path from 'path';

/**
 * Finds a user by their ID and returns all their data.
 * @param {string} id The user's UUID.
 * @returns The user's full data or null if not found.
 */
export const findUserById = async (id: string) => {
  const result = await pool.query('SELECT id, username, email, avatar_url, matches_played, wins, successful_bluffs, lies_called, times_caught_lying FROM users WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
};

/**
 * Finds a user by their username and returns their public profile data.
 * @param {string} username The username to search for.
 * @returns The user's public data or null if not found.
 */
export const findUserByUsername = async (username: string) => {
  const result = await pool.query('SELECT id, username, avatar_url FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) {
      return null;
  }
  return result.rows[0];
};


/**
 * Updates the avatar_url for a given user and cleans up the old avatar file.
 * @param {string} id The user's UUID.
 * @param {string} avatarUrl The new avatar URL path.
 * @returns The fully updated user data.
 */
export const updateUserAvatar = async (id: string, avatarUrl: string) => {
  const userResult = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [id]);

  if (userResult.rows.length > 0) {
    const oldAvatarUrl = userResult.rows[0].avatar_url;

    if (oldAvatarUrl) {
      const oldAvatarFilename = path.basename(oldAvatarUrl);
      const oldAvatarPath = path.join(__dirname, '..', '..', 'uploads', oldAvatarFilename);

      fs.unlink(oldAvatarPath, (err) => {
        if (err) {
          console.error(`Failed to delete old avatar: ${oldAvatarPath}`, err);
        } else {
          console.log(`Successfully deleted old avatar: ${oldAvatarPath}`);
        }
      });
    }
  }
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, id]);
  return findUserById(id);
};

/**
 * Updates the game statistics for all players in a room after a game concludes.
 * @param {string[]} playerIds - An array of all player IDs who participated.
 * @param {string | null} winnerId - The ID of the winning player, or null for a draw.
 */
export const updatePlayerStatsAfterGame = async (playerIds: string[], winnerId: string | null) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start a transaction

        for (const playerId of playerIds) {
            const isWinner = playerId === winnerId;
            // Increment matches_played for everyone, and wins only for the winner.
            const query = `
                UPDATE users
                SET
                    matches_played = matches_played + 1,
                    wins = wins + $1
                WHERE id = $2;
            `;
            await client.query(query, [isWinner ? 1 : 0, playerId]);
        }

        await client.query('COMMIT'); // Commit the transaction
        console.log(`Updated game stats for players: ${playerIds.join(', ')}`);
    } catch (e) {
        await client.query('ROLLBACK'); // Roll back in case of an error
        console.error('Error updating player stats, rolling back transaction.', e);
    } finally {
        client.release();
    }
};