import { Room } from "../models/room.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";

const getAllRooms = asyncHandler(async (req, res) => {
  try {
    const rooms = await Room.aggregate([
      { $match: {} },
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
          owner: {
            _id: 1,
            name: 1,
            email: 1,
            avatar: 1,
          },
          users: 1,
        },
      },
    ]);
    if (rooms.length <= 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, rooms, "No rooms found"));
    }

    return res
      .status(201)
      .json(new ApiResponse(201, rooms, "Rooms fetched successfully"));
  } catch (error) {
    throw new ApiError(500, "Something went wrong while fetching rooms");
  }
});

const getRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  if (!mongoose.isValidObjectId(roomId)) {
    throw new ApiError(400, "Invalid room Id");
  }

  const room = await Room.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(roomId),
      },
    },
    {
      $lookup: {
        from: "songs",
        localField: "songQueue",
        foreignField: "_id",
        as: "songQueue",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $lookup: {
        from: "songs",
        localField: "currentSong",
        foreignField: "_id",
        as: "currentSong",
      },
    },

    {
      $addFields: {
        owner: { $first: "$owner" },
        currentSong: {
          $ifNull: [{ $first: "$currentSong" }, null],
        },
      },
    },
    {
      $project: {
        roomName: 1,
        roomType: 1,
        owner: {
          _id: 1,
          name: 1,
          avatar: 1,
          email: 1,
        },
        streamType: 1,
        currentSong: 1,
        users: 1,
      },
    },
  ]);

  if (!room[0]) {
    throw new ApiError(404, "Room not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, room[0], "Room fetch successfully"));
});

const getSongQueue = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  if (!mongoose.isValidObjectId(roomId)) {
    throw new ApiError(400, "Invalid room ID");
  }

  const room = await Room.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(roomId),
      },
    },
    {
      $lookup: {
        from: "songs",
        localField: "songQueue",
        foreignField: "_id",
        as: "songQueue",
      },
    },
    {
      $addFields: {
        songQueue: {
          $sortArray: {
            input: "$songQueue",
            sortBy: { noOfVote: -1 },
          },
        },
      },
    },
    {
      $project: {
        songQueue: {
          externalId: 1,
          title: 1,

          artist: 1,
          source: 1,
          vote: 1,
          noOfVote: 1,
          room: 1,
          _id: 1,
        },
      },
    },
  ]);

  if (!room.length) {
    throw new ApiError(404, "Room not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, room[0].songQueue, "Song queue fetched successfully")
    );
});

export { getRoom, getSongQueue, getAllRooms };
