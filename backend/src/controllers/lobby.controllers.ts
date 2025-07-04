import { Request, Response, NextFunction } from "express";
import { CreateRoomSchema, EnterRoomSchema } from "../models/lobby.model";
import * as roomService from "../services/lobby.service";

export const CreateHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validInput = CreateRoomSchema.parse(req.body);

    const room = await roomService.createRoom(validInput);

    res.status(201).json({
      status: "success",
      data: { room },
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ status: "fail", message: err.errors });
    }
    if (err.message.includes("already exists")) {
      return res.status(409).json({ status: "fail", message: err.message });
    }
    next(err);
  }
};

export const EnterHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validInput = EnterRoomSchema.parse(req.body);

    const room = await roomService.enterRoom(validInput);

    res.status(201).json({
      status: "success",
      data: { room },
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ status: "fail", message: err.errors });
    }
    if (err.message.includes("already exists")) {
      return res.status(409).json({ status: "fail", message: err.message });
    }
    next(err);
  }
};
