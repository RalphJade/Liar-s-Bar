import { z } from 'zod';

// Zod schema for user registration data.
// It ensures that incoming data for registration has the correct shape and types.
export const RegisterUserSchema = z
  .object({
    username: z.string().min(3, 'Username must be at least 3 characters long'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'], // path of error
  });

// Zod schema for user login data.
export const LoginUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// TypeScript type inferred from the Zod schema for registration.
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;

// TypeScript type inferred from the Zod schema for login.
export type LoginUserInput = z.infer<typeof LoginUserSchema>;