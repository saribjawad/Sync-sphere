import { z } from "zod";
export const objectIdRegex = /^[a-f\d]{24}$/i;

export const CreateRoomSchema = z.object({
  userId: z.string().regex(objectIdRegex),
  roomType: z.enum(["youtube", "soundcloud"], {
    errorMap: () => ({
      message: "Room type is required",
    }),
  }),
  roomName: z.string({ required_error: "Room name is required" }),
  roomPassword: z.string({ required_error: "Room password is required" }),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().regex(objectIdRegex),
  roomPassword: z.string().optional(),
  userId: z.string().regex(objectIdRegex),
});

export const RefreshJoinRoomSchema = z.object({
  roomId: z.string(),
});
