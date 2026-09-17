import { Server } from "http";
import jwt from "jsonwebtoken";
import * as cookie from "cookie";
import { WebSocket, WebSocketServer } from "ws";
import { ACCESS_TOKEN_SECRET } from "../config/config.js";
import {
  handleCreateRoom,
  handleEndRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleRefreshJoinRoom,
  handleSyncAll,
  handleTimeStamps,
} from "../handlers/roomHandler.js";
import {
  handleAddSong,
  handleDeleteSong,
  handlePlayNextSong,
  handleUpVoteSong,
} from "../handlers/songHandler.js";
import { User } from "../models/user.model.js";
import { Room } from "../models/room.model.js";
import { Song } from "../models/song.model.js";
import RoomService from "../services/RoomService.js";

export interface ClientMessage {
  action: string;
  payload: any;
  requestId?: string;
}

interface ServerMessage {
  action: string;
  payload?: any;
  error?: string;
}

class WebSocketService {
  private wss: WebSocketServer;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", this.handleConnection.bind(this));
  }

  private async handleConnection(ws: WebSocket, req: any) {
    const cookies = cookie.parse(req.headers.cookie || "");
    const accessToken = cookies.accessToken || null;
    try {
      const decodedToken = jwt.verify(accessToken!, ACCESS_TOKEN_SECRET!);
      const id = (decodedToken as jwt.JwtPayload)._id;
      ws.userId = id;

      if (this.timeouts.has(id)) {
        clearTimeout(this.timeouts.get(id));
        this.timeouts.delete(id);
      }

      await User.findByIdAndUpdate(id, {
        temporarilyDisconnected: false,
        disconnectedAt: null,
      });

    } catch (error) {
      ws.close(4401, "Unauthorized");
      return;
    }

    ws.on("message", (data: ClientMessage) =>
      this.handleMessage(ws, data.toString())
    );

    ws.on("error", console.error);

    ws.on("close", () => this.handleClose(ws));
  }

  private async handleMessage(ws: WebSocket, data: string) {
    try {
      const clientData: ClientMessage = JSON.parse(data);

      switch (clientData.action) {
        case "CREATE_ROOM":
          await handleCreateRoom({ ws, clientData, wsService: this });
          break;

        case "ADD_SONG":
          await handleAddSong({ ws, clientData, wsService: this });
          break;

        case "JOIN_ROOM":
          await handleJoinRoom({ ws, clientData, wsService: this });
          break;

        case "REFRESH_JOIN_ROOM":
          await handleRefreshJoinRoom({ ws, clientData, wsService: this });
          break;

        case "LEAVE_ROOM":
          await handleLeaveRoom({ ws, clientData, wsService: this });
          break;

        case "END_ROOM":
          await handleEndRoom({ ws, clientData, wsService: this });
          break;

        case "DELETE_SONG":
          await handleDeleteSong({ ws, clientData, wsService: this });
          break;

        case "UPVOTE_SONG":
          await handleUpVoteSong({ ws, clientData, wsService: this });
          break;

        case "PLAY_NEXT_SONG":
          await handlePlayNextSong({ ws, clientData, wsService: this });
          break;

        case "TIMESTAMPS":
          handleTimeStamps({ ws, clientData, wsService: this });
          break;

        case "SYNC_ALL":
          handleSyncAll({ ws, clientData, wsService: this });
          break;

        default:
          break;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Internal Server Error";
      this.sendMessage(ws, "ERROR", errorMessage);
    }
  }

  private async handleClose(ws: WebSocket) {
    const userId = ws.userId;

    const disconnectTime = Date.now();

    // Check if user is already trying to reconnect
    if (this.timeouts.has(userId!)) {
      clearTimeout(this.timeouts.get(userId!));
      this.timeouts.delete(userId!);
    }

    // Preserve room membership briefly so a page refresh can reconnect.
    try {
      await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            temporarilyDisconnected: true,
            disconnectedAt: disconnectTime,
          },
        },
        { new: true }
      );
    } catch (error) {
      console.error("Failed to update user disconnection status:", error);
    }

    // Wait 15 seconds before cleaning up a disconnected user's room.
    const timeout = setTimeout(async () => {
      try {
        const user = await User.findById(userId);

        if (!user) return;

        const isActiveElsewhere = await this.checkUserActiveInOtherSessions(
          String(user._id)
        );

        if (isActiveElsewhere) {
          user.temporarilyDisconnected = false;
          user.disconnectedAt = null;
          await user.save({ validateBeforeSave: false });
          return;
        }

        if (user?.isAlive) {
          const room = await Room.findById(user.rooms[0]);

          if (!room) return;

          const activeRoomSession = RoomService.rooms.get(String(room._id));

          if (room.songQueue?.length >= 1) {
            await Song.deleteMany({ _id: { $in: room.songQueue } });
          }
          if (room.currentSong) {
            await Song.findByIdAndDelete(room.currentSong);
          }

          user.isAlive = false;
          user.rooms = [];
          await user.save({ validateBeforeSave: false });

          await Room.findByIdAndDelete(room._id);

          if (room.users?.length) {
            await User.updateMany(
              { _id: { $in: room.users } },
              {
                $set: {
                  "isJoined.status": false,
                  "isJoined.roomId": null,
                  temporarilyDisconnected: false,
                  disconnectedAt: null,
                },
              }
            );
          }

          activeRoomSession?.userTimestamps.delete(userId!);

          if (activeRoomSession) {
            this.sendMessage(ws, "END_ROOM", room._id);
            this.sendMessageToEveryoneExceptOwnerInRoom(
              ws,
              activeRoomSession!.users,
              "ROOM_ENDED",
              room._id
            );
            this.broadcast("REMOVE_ROOM", room._id);

            RoomService.rooms.delete(String(room._id));
          }
        }
        if (user?.isJoined.status) {
          const room = await Room.findOne({ users: user._id });

          if (!room) return;

          const activeRoomSession = RoomService.rooms.get(String(room._id));
          const connectedClients = activeRoomSession?.users;
          await Room.updateOne(
            { _id: room._id },
            { $pull: { users: user._id } }
          );

          user.isJoined = { status: false, roomId: null };
          user.temporarilyDisconnected = false;
          user.disconnectedAt = null;
          await user.save({ validateBeforeSave: false });

          if (activeRoomSession) {
            this.sendMessageToEveryoneExceptSenderInRoom(
              ws,
              connectedClients!,
              "LEFT_ROOM",
              {
                message: `${user.name} left the room`,
                noOfJoinedUsers: connectedClients?.size,
              }
            );

            this.sendMessage(ws, "LEAVE_ROOM", `${user.name} left the room`);
            RoomService.rooms.get(String(room._id))?.users.delete(ws);
          }
        }
      } catch (error) {
        console.error("Error during disconnection cleanup:", error);
      }
    }, 15000);

    this.timeouts.set(userId!, timeout);
  }

  private async checkUserActiveInOtherSessions(
    userId: string
  ): Promise<boolean> {
    // Check if user has an active WebSocket connection
    let isActive = false;

    this.wss.clients.forEach((client) => {
      const extendedClient = client as WebSocket;

      if (
        extendedClient.userId === userId &&
        extendedClient.readyState === WebSocket.OPEN
      ) {
        isActive = true;
      }
    });
    // Also check database for recent activity if needed
    if (!isActive) {
      const user = await User.findById(userId);
      if (user && !user.temporarilyDisconnected) {
        isActive = true;
      }
    }

    return isActive;
  }

  // send to all

  public broadcast(action: string, payload?: any) {
    const message: ServerMessage = { action, payload };

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // send to specific
  public sendMessage(ws: WebSocket, action: string, payload?: any) {
    const message: ServerMessage = { action, payload };
    ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(message));
  }

  // send to all except sender
  public sendMessageToAllExceptSender(
    ws: WebSocket,
    action: string,
    payload?: any
  ) {
    const message: ServerMessage = { action, payload };

    this.wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // send to everyone in room
  public sendMessageToEveryoneInRoom(
    roomUsers: WebSocket[],
    action: string,
    payload?: any
  ) {
    const message: ServerMessage = { action, payload };

    roomUsers.forEach((user) => {
      if (user.readyState === WebSocket.OPEN) {
        user.send(JSON.stringify(message));
      }
    });
  }

  // send to everyone in room except sender
  public sendMessageToEveryoneExceptSenderInRoom(
    ws: WebSocket,
    roomUsers: WebSocket[] | Set<WebSocket>,
    action: string,
    payload?: any
  ) {
    const message: ServerMessage = { action, payload };

    roomUsers.forEach((user) => {
      if (user !== ws && user.readyState === WebSocket.OPEN) {
        user.send(JSON.stringify(message));
      }
    });
  }

  // send to everyone in room except owner
  public sendMessageToEveryoneExceptOwnerInRoom(
    ownerWs: WebSocket,
    roomUsers: Set<WebSocket>,
    action: string,
    payload?: any
  ) {
    const message: ServerMessage = { action, payload };

    roomUsers.forEach((user) => {
      if (user !== ownerWs && user.readyState === WebSocket.OPEN) {
        user.send(JSON.stringify(message));
      }
    });
  }
}

export default WebSocketService;
