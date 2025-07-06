import express from 'express';
import { CreateHandler, EnterHandler } from '../controllers/lobby.controllers';

const router = express.Router();

//Defines the API endpoints to create or enter a game Room
router.post('/create', CreateHandler);
router.post('/enter', EnterHandler)

export default router