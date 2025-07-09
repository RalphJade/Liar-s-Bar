import { z } from 'zod';

export const CreateRoomSchema = z.object({
  roomName: z.string().min(3, 'Room name must be at least 3 characters long'),
  password: z
    .string()
    .min(3, 'Password must be at least 3 characters long')
    .optional()
    .or(z.literal('')), // allows empty string as well
}).refine(
  (data) => {
    // It ensures that if a password is provided, it meets the length requirement.
    return !data.password || data.password.length >= 3;
  },
  {
    path: ['password'],
    message: 'Password must be at least 3 characters long',
  }
);

export const EnterRoomSchema = z.object({
  roomCode: z.string().length(5, 'The room code must be exactly 5 characters long'),
  password: z.string().optional(),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type EnterRoomInput = z.infer<typeof EnterRoomSchema>;