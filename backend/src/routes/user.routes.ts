import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect } from '../middlewares/auth.middleware';
import { getMeHandler, updateAvatarHandler } from '../controllers/user.controller';

const router = express.Router();

// --- Multer Configuration ---
// Define the upload folder.
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure the storage for files, defining where and how they will be saved.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Save files to the 'uploads' folder
  },
  filename: (req, file, cb) => {
    // Create a unique file name to avoid conflicts.
    // Example: avatar-userId-timestamp.png
    const uniqueSuffix = `${req.user?.id}-${Date.now()}`;
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Filter files to accept only JPG and PNG images.
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

/**
 * Protected route to retrieve full data of the authenticated user.
 * The /me route now uses a dedicated handler to fetch all data from the DB.
 */
router.get('/me', protect, getMeHandler);

/**
 * Protected route to update the user's avatar.
 * The 'protect' middleware ensures authentication.
 * The 'upload.single('avatar')' middleware handles the file upload from the 'avatar' field.
 */
router.patch('/me/avatar', protect, upload.single('avatar'), updateAvatarHandler);

export default router;