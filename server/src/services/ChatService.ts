import { randomUUID } from "node:crypto";
import { z } from "zod";
import { WebSocket } from "ws";
import { Room } from "../models/room.model.js";
import { User } from "../models/user.model.js";
import RoomService from "./RoomService.js";

export const REACTIONS = ["❤️", "🔥", "😂", "👏", "🎵", "🙌"] as const;

const roomPayload = z.object({ roomId: z.string().regex(/^[a-f\d]{24}$/i) });

const messagePayload = roomPayload.extend({
	text: z.string().trim().min(1).max(500),
	requestId: z.string().uuid(),
});

const reactionPayload = roomPayload.extend({ emoji: z.enum(REACTIONS) });
type RoomSession = NonNullable<ReturnType<typeof RoomService.rooms.get>>;

export interface ChatMessage {
	id: string;
	roomId: string;
	userId: string;
	name: string;
	text: string;
	createdAt: string;
	requestId: string;
}

// History belongs to the active room session and is released when that session ends.
const history = new WeakMap<RoomSession, ChatMessage[]>();
const limits = new WeakMap<RoomSession, Map<string, number[]>>();

async function getMembership(ws: WebSocket, roomId: string) {
	const session = RoomService.rooms.get(roomId);

	if (!ws.userId || !session?.users.has(ws))
		throw new Error("Join the room before using chat.");

	const room = await Room.findById(roomId);

	if (
		!room ||
		(String(room.owner) !== ws.userId &&
			!room.users.some((id) => String(id) === ws.userId))
	) {
		throw new Error("You are no longer in this room.");
	}

	// Membership may change while the database request is in flight.
	if (RoomService.rooms.get(roomId) !== session || !session.users.has(ws)) {
		throw new Error("This room is no longer active.");
	}

	return {
		session,
		memberIds: new Set([String(room.owner), ...room.users.map(String)]),
	};
}

function checkRate(session: RoomSession, userId: string) {
	const now = Date.now();
	const users = limits.get(session) || new Map<string, number[]>();
	// Remove expired entries so departed listeners do not accumulate in long sessions.

	for (const [id, timestamps] of users) {
		const recent = timestamps.filter((time) => now - time < 5000);

		if (recent.length) users.set(id, recent);
		else users.delete(id);
	}

	const recent = users.get(userId) || [];

	if (recent.length >= 5)
		throw new Error("Slow down a little. Try again in a few seconds.");
	users.set(userId, [...recent, now]);

	limits.set(session, users);
}

export async function getChatHistory(ws: WebSocket, payload: unknown) {
	const { roomId } = roomPayload.parse(payload);
	const { session } = await getMembership(ws, roomId);

	return { roomId, messages: history.get(session) || [] };
}

export async function sendChat(
	ws: WebSocket,
	action: string,
	payload: unknown,
) {
	const input =
		action === "CHAT_MESSAGE"
			? messagePayload.parse(payload)
			: reactionPayload.parse(payload);
	const { session, memberIds } = await getMembership(ws, input.roomId);

	checkRate(session, ws.userId!);
	// Sender identity always comes from the authenticated socket, never from the payload.

	const user = await User.findById(ws.userId).select("name");

	if (!user) throw new Error("Please sign in again.");
	if (
		RoomService.rooms.get(input.roomId) !== session ||
		!session.users.has(ws)
	) {
		throw new Error("You are no longer in this room.");
	}

	const event = {
		id: randomUUID(),
		roomId: input.roomId,
		userId: ws.userId!,
		name: user.name,
		createdAt: new Date().toISOString(),
		...("text" in input
			? { text: input.text, requestId: input.requestId }
			: { emoji: input.emoji }),
	};

	if ("text" in event) {
		history.set(
			session,
			[...(history.get(session) || []), event as ChatMessage].slice(-100),
		);
	}

	const serialized = JSON.stringify({ action, payload: event });

	for (const client of session.users) {
		if (client.readyState === WebSocket.OPEN && memberIds.has(client.userId!))
			client.send(serialized);
	}
}
