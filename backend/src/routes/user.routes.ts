import express from 'express';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

/**
 * Defines a protected route to get the current authenticated user's data.
 * The 'protect' middleware runs first, ensuring only users with a valid token
 * can access this endpoint.
 */
router.get('/me', protect, (req, res) => {
  // If the 'protect' middleware succeeds, the 'req.user' object will be available.
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

export default router;