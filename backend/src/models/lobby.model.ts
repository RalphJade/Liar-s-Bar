import { z } from 'zod';

export const CreateRoomSchema = z.object({
  roomName: z.string().min(3, 'O nome da sala deve ter ao menos 3 caracteres'),
  password: z
    .string()
    .min(3, 'A senha deve ter pelo menos 3 caracteres')
    .optional()
    .or(z.literal('')), // permite string vazia também
}).refine(
  (data) => {
    return !data.password || data.password.length >= 3;
  },
  {
    path: ['password'],
    message: 'A senha deve ter pelo menos 3 caracteres',
  }
);

export const EnterRoomSchema = z.object({
  roomName: z.string().min(3, 'O nome da sala deve ter ao menos 3 caracteres'),
  password: z.string().optional(),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type EnterRoomInput = z.infer<typeof EnterRoomSchema>;
