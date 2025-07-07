import { pool } from '../database';
import fs from 'fs';
import path from 'path';

// Finds a user by their ID and returns all their data.
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


// Updates the avatar_url for a given user.
export const updateUserAvatar = async (id: string, avatarUrl: string) => {
    // 1. Primeiro, busca os dados atuais do usuário para pegar a URL do avatar antigo.
  const userResult = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [id]);

  if (userResult.rows.length > 0) {
    const oldAvatarUrl = userResult.rows[0].avatar_url;

    // 2. Se existia uma URL de avatar antiga...
    if (oldAvatarUrl) {
      // Constrói o caminho completo para o arquivo antigo no disco.
      // A URL é /uploads/filename.png, então removemos o /uploads/ para pegar só o nome do arquivo.
      const oldAvatarFilename = path.basename(oldAvatarUrl);
      const oldAvatarPath = path.join(__dirname, '..', '..', 'uploads', oldAvatarFilename);

      // 3. Tenta deletar o arquivo antigo do disco.
      fs.unlink(oldAvatarPath, (err) => {
        if (err) {
          // Não quebra a aplicação se o arquivo não for encontrado, apenas loga o erro.
          // Isso evita problemas se o arquivo já tiver sido deletado manualmente.
          console.error(`Falha ao deletar o avatar antigo: ${oldAvatarPath}`, err);
        } else {
          console.log(`Avatar antigo deletado com sucesso: ${oldAvatarPath}`);
        }
      });
    }
  }
  await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, id]);
  // Return the fully updated user data
  return findUserById(id);
};