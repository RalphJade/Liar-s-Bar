import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Define the structure of the JWT payload.
interface UserPayload {
  id: string;
  username: string;
}

// Extend the global Express Request interface to include an optional 'user' property.
// This allows us to safely attach the decoded user payload to the request object.
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

/**
 * Middleware to protect routes by verifying the JWT token.
 * It reads the token from the httpOnly cookie, verifies it, and attaches the
 * decoded payload to the request object for use in subsequent handlers.
 */
export const protect = (req: Request, res: Response, next: NextFunction) => {
  // Attempt to retrieve the token from the request's cookies.
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ status: 'fail', message: 'Not authorized, no token provided' });
  }

  try {
    // Verify the token's signature using the secret key.
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as UserPayload;
    
    // Attach the decoded user payload to the request object.
    req.user = decoded;

    // Proceed to the next middleware or route handler.
    next();
  } catch (error) {
    res.status(401).json({ status: 'fail', message: 'Not authorized, token is invalid' });
  }
};

/**
 * Function to verify a JWT token extracted manually (e.g., in WebSocket handshake).
 * Returns the decoded user data if valid, or null if invalid.
 */
export const verifyTokenForWebSocket = (
  token: string | undefined
): UserPayload | null => {
  if (!token) return null;

try{    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as UserPayload;

    return decoded;
}catch(error){
    return null;
}
};