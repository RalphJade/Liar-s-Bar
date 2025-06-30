import { Request, Response, NextFunction } from 'express';
import { RegisterUserSchema, LoginUserSchema } from '../models/user.model';
import * as authService from '../services/auth.service';

/**
 * Handles the HTTP request for new user registration.
 * It validates the request body and calls the registration service.
 */
export const registerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body against the Zod schema.
    const validatedInput = RegisterUserSchema.parse(req.body);

    const user = await authService.registerUser(validatedInput);
    
    res.status(201).json({
      status: 'success',
      data: { user },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ status: 'fail', message: err.errors });
    }
    if (err.message.includes('already exists')) {
      return res.status(409).json({ status: 'fail', message: err.message });
    }
    next(err);
  }
};

/**
 * Handles the HTTP request for user login.
 * On successful authentication, it sets a secure, httpOnly cookie with the JWT.
 */
export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedInput = LoginUserSchema.parse(req.body);
    const { token, user } = await authService.loginUser(validatedInput);

    // Set the JWT as a secure, httpOnly cookie. This is the core of our secure auth.
    res.cookie('token', token, {
      httpOnly: true, // Prevents client-side JavaScript from accessing the cookie.
      secure: process.env.NODE_ENV === 'production', // Ensures the cookie is sent only over HTTPS.
      sameSite: 'strict', // Mitigates CSRF attacks by preventing the browser from sending the cookie along with cross-site requests.
      maxAge: 24 * 60 * 60 * 1000, // Sets the cookie's expiration to 1 day, matching the JWT.
      path: '/', // The cookie is available to all pages.
    });

    // Send back user data, but crucially, not the token itself in the response body.
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ status: 'fail', message: err.errors });
    }
    if (err.message.includes('Invalid credentials')) {
      return res.status(401).json({ status: 'fail', message: err.message });
    }
    next(err);
  }
};

/**
 * Handles the HTTP request for user logout.
 * It clears the authentication cookie, effectively logging the user out.
 */
export const logoutHandler = (req: Request, res: Response) => {
  // To clear a cookie, we set its name to an empty string and its expiration
  // date to a time in the past.
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ status: 'success' });
};