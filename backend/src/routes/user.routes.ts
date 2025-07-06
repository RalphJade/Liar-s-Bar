import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect } from '../middlewares/auth.middleware';
import { getMeHandler, updateAvatarHandler, getUserByUsernameHandler } from '../controllers/user.controller';

const router = express.Router();

// --- Multer Configuration ---
// Define upload path
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configura o storage para os arquivos, definindo onde e com que nome serão salvos.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Salva os arquivos na pasta 'uploads'
  },
  filename: (req, file, cb) => {
    // Creat an unique filename for each uploaded file.
    // Ex: avatar-userId-timestamp.png
    const uniqueSuffix = `${req.user?.id}-${Date.now()}`;
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Filter to allow only specific file types (JPG and PNG).
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

/**
 * Route to get the currently authenticated user's full data.
 * The 'protect' middleware runs first.
 */
router.get('/me', protect, getMeHandler);

/**
 * Route to update the current user's avatar.
 */
router.patch('/me/avatar', protect, upload.single('avatar'), updateAvatarHandler);

/**
 * Route to get another user's public profile by their username.
 * This is protected; only logged-in users can look up other players.
 */
router.get('/:username', protect, getUserByUsernameHandler);


export default router;