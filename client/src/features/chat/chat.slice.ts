import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { z } from "zod";

export const REACTIONS = ["❤️", "🔥", "😂", "👏", "🎵", "🙌"] as const;

const eventSchema = z.object({
	id: z.string(),
	roomId: z.string(),
	userId: z.string(),
	name: z.string(),
	createdAt: z.string(),
});

export const chatMessageSchema = eventSchema.extend({
	text: z.string(),
	requestId: z.string(),
});
export const chatReactionSchema = eventSchema.extend({
	emoji: z.enum(REACTIONS),
});
export const chatHistorySchema = z.object({
	roomId: z.string(),
	messages: z.array(chatMessageSchema),
});

type Message = z.infer<typeof chatMessageSchema>;
type Reaction = z.infer<typeof chatReactionSchema>;

interface ChatState {
	roomId: string | null;
	messages: Message[];
	reactions: Reaction[];
	ready: boolean;
	error: string | null;
}

const initialState: ChatState = {
	roomId: null,
	messages: [],
	reactions: [],
	ready: false,
	error: null,
};
const chatSlice = createSlice({
	name: "chat",
	initialState,
	reducers: {
		openChat: (state, { payload }: PayloadAction<string>) => {
			if (state.roomId !== payload) return { ...initialState, roomId: payload };
		},
		closeChat: () => initialState,
		setChatHistory: (
			state,
			{ payload }: PayloadAction<z.infer<typeof chatHistorySchema>>,
		) => {
			if (state.roomId !== payload.roomId) return;
			// Keep live messages that arrived while history was loading.
			const merged = new Map(
				[...payload.messages, ...state.messages].map((message) => [
					message.id,
					message,
				]),
			);
			state.messages = [...merged.values()]
				.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
				.slice(-100);
			state.ready = true;
			state.error = null;
		},
		addChatMessage: (state, { payload }: PayloadAction<Message>) => {
			if (
				state.roomId !== payload.roomId ||
				state.messages.some((message) => message.id === payload.id)
			)
				return;
			state.messages = [...state.messages, payload].slice(-100);
		},
		addChatReaction: (state, { payload }: PayloadAction<Reaction>) => {
			if (state.roomId === payload.roomId)
				state.reactions = [...state.reactions, payload].slice(-8);
		},
		removeChatReaction: (state, { payload }: PayloadAction<string>) => {
			state.reactions = state.reactions.filter(
				(reaction) => reaction.id !== payload,
			);
		},
		setChatError: (
			state,
			{ payload }: PayloadAction<{ roomId: string; message: string }>,
		) => {
			if (state.roomId === payload.roomId) state.error = payload.message;
		},
	},
});

export const {
	openChat,
	closeChat,
	setChatHistory,
	addChatMessage,
	addChatReaction,
	removeChatReaction,
	setChatError,
} = chatSlice.actions;

export default chatSlice.reducer;
