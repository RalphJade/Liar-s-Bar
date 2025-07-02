import { redisClient } from "../database";
import { generateCodeWithFaker } from "../utils/room.util";
import { CreateRoomInput, EnterRoomInput } from "../models/lobby.model";

export const createRoom = async (input: CreateRoomInput) => {
  const { roomName, password } = input;

  // Search for all the values of the room
  const allRooms = await redisClient.hvals("rooms");
  const parsedRooms = allRooms.map((room) => JSON.parse(room));
  const usedNames = new Set(parsedRooms.map((r) => r.roomName));
  const usedCodes = new Set(parsedRooms.map((r) => r.roomCode));

  if (usedNames.has(roomName)) {
    throw new Error("Já existe uma sala com esse nome");
  }

  //Generate an unique code
  let roomCode = "";
  do {
    roomCode = generateCodeWithFaker(); // Ex: "A3B7F"
  } while (usedCodes.has(roomCode));

  // Create room object
  const roomData = {
    roomName,
    password: password || null,
    roomCode,
  };

  // Save the room info on Redis
  await redisClient.hset("rooms", roomName, JSON.stringify(roomData));

  return roomData;
};

export const enterRoom = async (input: EnterRoomInput) => {
  const { roomCode, password } = input;

  const allRooms = await redisClient.hvals("rooms");
  const parsedRooms = allRooms.map((room) => JSON.parse(room));

  const room = parsedRooms.find((room) => room.roomCode === roomCode);

  if (!room) {
    throw new Error("Sala não encontrada")
  }

  if (room.password){
    if (!password) {
      throw new Error("Esta sala requer uma senha")
    }
  }

  if (room.password !== password) {
    throw new Error("Senha incorreta")
  }

  return room
};
