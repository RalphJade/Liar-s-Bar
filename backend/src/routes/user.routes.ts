import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect } from '../middlewares/auth.middleware';
import { getMeHandler, updateAvatarHandler } from '../controllers/user.controller';

const router = express.Router();

// --- Multer Configuration ---
// Define a pasta de uploads.
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
    // Cria um nome de arquivo único para evitar conflitos.
    // Ex: avatar-userId-timestamp.png
    const uniqueSuffix = `${req.user?.id}-${Date.now()}`;
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Filtra os arquivos para aceitar apenas imagens JPG e PNG.
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

/**
 * Rota protegida para buscar os dados completos do usuário autenticado.
 * A rota /me agora usará um handler dedicado para buscar todos os dados do DB.
 */
router.get('/me', protect, getMeHandler);

/**
 * Rota protegida para atualizar o avatar do usuário.
 * O middleware 'protect' garante a autenticação.
 * O middleware 'upload.single('avatar')' processa o upload do arquivo do campo 'avatar'.
 */
router.patch('/me/avatar', protect, upload.single('avatar'), updateAvatarHandler);


export default router;