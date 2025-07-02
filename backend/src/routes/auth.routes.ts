import express from 'express';
import { registerHandler, loginHandler, logoutHandler } from '../controllers/auth.controller';

const router = express.Router();

// Defines the API endpoints for the authentication module.
router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/logout', logoutHandler);

export default router;