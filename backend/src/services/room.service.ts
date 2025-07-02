import { redisClient } from "../database";
import { CreateRoomInput, EnterRoomInput } from "../models/lobby.model";

export const createRoom = async (input: CreateRoomInput) => {
  const { roomName, password } = input;

  // Check if there's a room with the same name
  const roomExists = await redisClient.hget("rooms", roomName);
  if (roomExists) {
    throw new Error("Já existe uma sala com esse nome.");
  }

  const roomData = {
    roomName,
    password: password || null,
    createdAt: Date.now(),
  };

  // Sets the room directly with the name as key
  await redisClient.hset("rooms", roomName, JSON.stringify(roomData));

  return roomData;
};

export const enterRoom = async (input: EnterRoomInput) => {
  const { roomName, password } = input;

  
};