import mongoose, { ObjectId, Types } from "mongoose";
import { Room } from "../models/room.model.js";
import { Song } from "../models/song.model.js";
import { User } from "../models/user.model.js";
import {
  AddSongSchema,
  DeleteSongSchema,
  extractedSongSchema,
  UpVoteSongSchema,
} from "../schema/songSchemas.js";
import {
  CreateRoomSchema,
  JoinRoomSchema,
  RefreshJoinRoomSchema,
} from "../schema/roomSchemas.js";
import { ApiError } from "../utils/ApiError.js";
import { extractYouTubeID } from "../utils/extractYoutubeId.js";
import { WebSocket } from "ws";
import { getYouTubeDetails } from "./YouTubeService.js";
import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

const RoomPayLoadSchema = CreateRoomSchema.extend({
  ws: z.instanceof(WebSocket),
  userId: z.string().regex(objectIdRegex, "Invalid MongoDB ObjectID"),
});

const JoinRoomPayloadSchema = JoinRoomSchema.extend({
  ws: z.instanceof(WebSocket),
  userId: z.string().regex(objectIdRegex, "Invalid MongoDB ObjectID"),
});

const RefreshJoinRoomPayloadSchema = RefreshJoinRoomSchema.extend({
  ws: z.instanceof(WebSocket),
  userId: z.string().regex(objectIdRegex),
});

const LeaveRoomPayloadSchema = z.object({
  userId: z.string().regex(objectIdRegex),
  roomId: z.string().regex(objectIdRegex),
});

const TimestampsPayloadSchema = LeaveRoomPayloadSchema.extend({
  username: z.string(),
  timestamps: z.number(),
});

type CreateRoomPayloadType = z.infer<typeof RoomPayLoadSchema>;
type AddSongPayloadType = z.infer<typeof AddSongSchema>;
type JoinRoomPayloadType = z.infer<typeof JoinRoomPayloadSchema>;
type RefreshJoinRoomType = z.infer<typeof RefreshJoinRoomPayloadSchema>;
type LeaveRoomType = z.infer<typeof LeaveRoomPayloadSchema>;
type EndRoomType = z.infer<typeof LeaveRoomPayloadSchema>;
type DeleteSongType = z.infer<typeof DeleteSongSchema>;
type UpVoteSongType = z.infer<typeof UpVoteSongSchema>;
type PlayNextSongType = z.infer<typeof DeleteSongSchema>;
type TimestampsType = z.infer<typeof TimestampsPayloadSchema>;

interface UserTimestamp {
  username: string;
  timestamps: number;
}

class RoomService {
  public static rooms: Map<
    string,
    {
      users: Set<WebSocket>;
      roomName: string;
      roomType: "youtube" | "soundcloud";
      ownerWs?: WebSocket;
      userTimestamps: Map<string, UserTimestamp>;
      roomPassword: string;
    }
  > = new Map();

  static async createRoom(payload: CreateRoomPayloadType) {
    try {
      const room = await Room.create({
        roomType: payload.roomType,
        roomName: payload.roomName,
        roomPassword: payload.roomPassword,
        owner: payload.userId,
      });
      const updatedRoom = await Room.aggregate([
        {
          $match: {
            _id: room._id,
          },
        },
        {
          $lookup: {
            from: "users",
            foreignField: "_id",
            localField: "owner",
            as: "owner",
          },
        },
        {
          $addFields: {
            owner: { $first: "$owner" },
          },
        },
        {
          $project: {
            _id: 1,
            roomType: 1,
            roomName: 1,
            users: 1,
            currentSong: 1,
            owner: {
              _id: 1,
              name: 1,
              email: 1,
              avatar: 1,
            },
          },
        },
      ]);

      if (!updatedRoom) {
        throw new ApiError(500, "Something went wrong while creating room");
      }

      await User.findByIdAndUpdate(
        payload.userId,
        {
          isAlive: true,
          $push: { rooms: room._id },
        },
        { new: true }
      );

      RoomService.rooms.set(String(room._id), {
        users: new Set(),
        roomName: payload.roomName,
        roomPassword: payload.roomPassword,
        ownerWs: payload.ws,
        userTimestamps: new Map(),
        roomType: payload.roomType,
      });

      RoomService.rooms.get(String(room._id))?.users.add(payload.ws);

      return updatedRoom[0];
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Failed to create room";

      throw new Error(errMessage);
    }
  }

  static async addSong(payload: AddSongPayloadType) {
    try {
      const { roomId, songUrl } = payload;

      const room = await Room.findById(roomId);

      if (!room) {
        throw new ApiError(404, "Room not found");
      }

      const roomUsers = this.rooms.get(String(room._id))?.users;

      const extractedId = extractYouTubeID(songUrl);
      if (!extractedId) throw new Error("Please enter a valid YouTube video URL.");

      const { title, channel } = await getYouTubeDetails(extractedId);

      const validatedData = extractedSongSchema.parse({
        externalId: extractedId,
        title,
        source: room.roomType,
        artist: channel,
        room: roomId,
      });

      const song = await Song.create(validatedData);
      const filteredSong = await Song.findById(song._id)
        .select("-createdAt -updatedAt -__v")
        .lean();

      let updateQuery;
      if (!room.currentSong && room.songQueue.length === 0) {
        updateQuery = { currentSong: filteredSong };
      } else {
        updateQuery = { $push: { songQueue: filteredSong } };
      }

      await Room.findByIdAndUpdate(roomId, updateQuery, {
        new: true,
      });

      return { filteredSong, roomUsers };
    } catch (error) {
      if ((error as any).code === 11000) {
        throw new Error("Video already in the queue/playing");
      }

      const errMessage =
        error instanceof Error ? error.message : "Failed to create room";

      throw new Error(errMessage);
    }
  }

  static async joinRoom(payload: JoinRoomPayloadType) {
    try {
      const { roomId, roomPassword, userId, ws } = payload;
      const room = await Room.findById(roomId);
      const user = await User.findById(userId);

      if (!user) {
        throw new ApiError(404, "User not found");
      }
      if (!room) {
        throw new ApiError(404, "Room not found");
      }

      const activeRoomSession = this.rooms.get(roomId);

      if (!activeRoomSession) {
        throw new ApiError(404, "Room not found in active sessions");
      }

      const isValidPassword = await room.isPasswordCorrect(roomPassword!);
      if (!isValidPassword) {
        throw new ApiError(401, "Invalid password");
      }
      room.users.push(userId as any);
      await room.save({ validateBeforeSave: false });
      user.isJoined = {
        status: true,
        roomId: roomId as any,
      };
      await user.save({ validateBeforeSave: false });

      activeRoomSession.users.add(ws);
      activeRoomSession?.userTimestamps.set(userId, {
        timestamps: 0,
        username: user.name,
      });

      // Set up disconnect handler for the WebSocket
      ws.on("close", () => {
        activeRoomSession.users.delete(ws);
      });

      const joinedUsers = room.users.filter(
        (user) => user.toString() !== (room.owner as any).toString()
      );

      return {
        userName: user?.name,
        roomId: room._id,
        connectedClients: activeRoomSession.users,
        ownerWs: activeRoomSession.ownerWs,
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Failed to join room";
      throw new Error(errMessage);
    }
  }

  static async refreshJoinRoom(payload: RefreshJoinRoomType) {
    const { roomId, userId, ws } = payload;

    if (!mongoose.isValidObjectId(roomId)) {
      throw new ApiError(400, "Invalid Room ID");
    }

    const room = await Room.findById(roomId);
    if (!room) {
      throw new ApiError(404, "Room not found");
    }

    const roomIdString = String(room._id);

    if (!this.rooms.has(roomIdString)) {
      this.rooms.set(roomIdString, {
        users: new Set<WebSocket>(),
        roomName: room.roomName,
        roomPassword: room.roomPassword,
        roomType: room.roomType,
        userTimestamps: new Map(),
        ownerWs: undefined,
      });
    }

    const activeSessionRoom = this.rooms.get(roomIdString)!;

    if (String(room.owner) === userId) {
      if (activeSessionRoom?.ownerWs !== ws) {
        activeSessionRoom!.ownerWs = ws;
        activeSessionRoom.users.add(ws);
      }
    } else if (
      room.users.some(
        (user) => user.toString() === userId && !activeSessionRoom.users.has(ws)
      )
    ) {
      activeSessionRoom?.users.add(ws);
    }

    ws.on("close", () => {
      activeSessionRoom.users.delete(ws);
      return;
    });

    return {
      noOfJoinedUsers: activeSessionRoom.users.size,
      connectedClients: activeSessionRoom.users,
    };
  }

  static async leaveRoom(payload: LeaveRoomType) {
    try {
      const { roomId, userId } = payload;

      if (!mongoose.isValidObjectId(roomId)) {
        throw new ApiError(400, "Invalid Room ID");
      }

      const room = await Room.findById(roomId);
      const user = await User.findById(userId);
      const activeRoomSession = this.rooms.get(roomId);

      if (!room) {
        throw new ApiError(404, "Room not found");
      }

      if (!user) {
        throw new ApiError(401, "Invalid userId");
      }

      await Room.updateOne({ _id: roomId }, { $pull: { users: userId } });
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          isJoined: {
            status: false,
            roomId: null,
          },
        },
        { new: true }
      );

      if (!updatedUser) {
        throw new ApiError(500, "Something went wrong while updating room");
      }

      activeRoomSession?.userTimestamps.delete(userId);

      return {
        username: updatedUser.name,
        connectedClient: activeRoomSession?.users,
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Failed to join room";
      throw new Error(errMessage);
    }
  }

  static async endRoom(payload: EndRoomType) {
    try {
      const { roomId, userId } = payload;

      if (!mongoose.isValidObjectId(roomId)) {
        throw new ApiError(400, "Invalid Room ID");
      }

      const room = await Room.findById(roomId);
      const user = await User.findById(userId);
      const activeRoomSession = this.rooms.get(roomId);

      if (!room) {
        throw new ApiError(404, "Room not found");
      }

      if (!user) {
        throw new ApiError(401, "Invalid userId");
      }

      if (room.songQueue?.length >= 1) {
        await Song.deleteMany({ _id: { $in: room.songQueue } });
      }

      if (room.currentSong) {
        await Song.findByIdAndDelete(room.currentSong);
      }

      await User.findByIdAndUpdate(
        userId,
        {
          isAlive: false,
          $pull: { rooms: roomId },
        },
        { new: true }
      );

      await Room.findByIdAndDelete(roomId);

      if (room.users?.length) {
        await User.updateMany(
          { _id: { $in: room.users } },
          {
            $set: {
              "isJoined.status": false,
              "isJoined.roomId": null,
            },
          }
        );
      }

      return {
        connectedClients: activeRoomSession?.users,
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Failed to join room";
      throw new Error(errMessage);
    }
  }

  static async deleteSong(payload: DeleteSongType) {
    try {
      const { roomId, songId } = payload;

      if (!mongoose.isValidObjectId(roomId)) {
        throw new ApiError(400, "Invalid Room ID");
      }

      if (!mongoose.isValidObjectId(songId)) {
        throw new ApiError(400, "Invalid Song ID");
      }

      const room = await Room.findByIdAndUpdate(
        roomId,
        {
          $pull: { songQueue: songId },
        },
        {
          new: true,
        }
      );

      if (!room) {
        throw new ApiError(500, "Something went wrong while updating room");
      }
      const activeRoomSession = this.rooms.get(roomId);

      await Song.findByIdAndDelete(songId);

      return { connectedClients: activeRoomSession?.users };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Failed to join room";
      throw new Error(errMessage);
    }
  }

  static async upvoteSong(payload: UpVoteSongType) {
    const { roomId, songId, userId } = payload;

    if (!mongoose.isValidObjectId(roomId)) {
      throw new ApiError(400, "Invalid Room ID");
    }

    if (!mongoose.isValidObjectId(songId)) {
      throw new ApiError(400, "Invalid Song ID");
    }

    const room = await Room.findById(roomId);

    if (!room) {
      throw new ApiError(404, "Room not found");
    }
    const activeRoomSession = this.rooms.get(roomId);

    const song = await Song.findById(songId);

    if (!song) {
      throw new ApiError(404, "Song not found");
    }

    if (song.vote.some((voteId) => String(voteId) === userId)) {
      song.vote = song.vote.filter((voteId) => String(voteId) !== userId);
      song.noOfVote = song.noOfVote - 1;
      await song.save({ validateBeforeSave: false });
    } else {
      song.vote = [...song.vote, new mongoose.Types.ObjectId(userId)];
      song.noOfVote = song.noOfVote + 1;
      await song.save({ validateBeforeSave: false });
    }

    return {
      connectedClients: activeRoomSession?.users,
      userId,
    };
  }

  static async playNextSong(payload: PlayNextSongType) {
    try {
      const { roomId, songId } = payload;

      if (!mongoose.isValidObjectId(roomId)) {
        throw new ApiError(400, "Invalid Room ID");
      }

      if (!mongoose.isValidObjectId(songId)) {
        throw new ApiError(400, "Invalid Song ID");
      }

      const room = await Room.findById(roomId);

      const nextSong = await Song.findById(songId).select(
        "-createdAt -updatedAt"
      );

      if (!room) {
        throw new ApiError(404, "Room not found");
      }
      if (!nextSong) {
        throw new ApiError(404, "Song not found");
      }

      const activeSessionRoom = this.rooms.get(roomId);
      await Song.findByIdAndDelete(room.currentSong);

      room.currentSong = nextSong;
      room.songQueue = room.songQueue.filter((song) => String(song) !== songId);
      await room.save({ validateBeforeSave: false });

      return { song: nextSong, connectedClients: activeSessionRoom?.users };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Failed to join room";
      throw new Error(errMessage);
    }
  }

  static async timestamps(payload: TimestampsType) {
    try {
      const { roomId, timestamps, userId, username } = payload;

      const activeRoomSession = this.rooms.get(roomId);

      if (!activeRoomSession) return;

      if (userId && activeRoomSession.userTimestamps.has(userId)) {
        const userTimestamp = activeRoomSession.userTimestamps.get(userId)!;
        userTimestamp.timestamps = timestamps;
        userTimestamp.username = username;
      }

      return {
        ownerWs: activeRoomSession.ownerWs,
        username,
        timestamps,
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : "Failed to join room";
      throw new Error(errMessage);
    }
  }
}

export default RoomService;
