import { FormEvent, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../app/hook";
import { useWebSocketContext } from "../contexts/webSocketProvider";
import {
	REACTIONS,
	removeChatReaction,
	setChatError,
} from "../features/chat/chat.slice";

export default function RoomChat({ roomId }: { roomId: string }) {
	const dispatch = useAppDispatch();

	const { messages, reactions, ready, error } = useAppSelector(
		(state) => state.chat,
	);
	const userId = useAppSelector((state) => state.auth.userInfo?._id);
	const { sendMessage, isConnected } = useWebSocketContext();
	const [draft, setDraft] = useState("");
	const [pending, setPending] = useState<{
		text: string;
		requestId: string;
	} | null>(null);

	const listRef = useRef<HTMLDivElement>(null);
	const reactionTimers = useRef(new Map<string, number>());
	const followLatest = useRef(true);

	const canSend = isConnected && ready;

	useEffect(() => {
		if (followLatest.current && listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [messages]);

	useEffect(() => {
		if (!pending) return;

		const delivered = messages.some(
			(message) =>
				message.userId === userId && message.requestId === pending.requestId,
		);

		if (delivered) {
			setDraft((current) => (current.trim() === pending.text ? "" : current));
			setPending(null);
		}
	}, [messages, pending, userId]);

	useEffect(() => {
		if (!pending) return;

		const timer = window.setTimeout(() => {
			setPending(null);
			dispatch(
				setChatError({
					roomId,
					message:
						"Message not confirmed. Check your connection before trying again.",
				}),
			);
		}, 8000);

		return () => window.clearTimeout(timer);
	}, [pending, dispatch, roomId]);

	useEffect(() => {
		if (error || !isConnected) setPending(null);
	}, [error, isConnected]);

	useEffect(() => {
		// Reactions are momentary; keep them out of the permanent message list.
		for (const reaction of reactions) {
			if (reactionTimers.current.has(reaction.id)) continue;

			const timer = window.setTimeout(() => {
				reactionTimers.current.delete(reaction.id);
				dispatch(removeChatReaction(reaction.id));
			}, 4000);

			reactionTimers.current.set(reaction.id, timer);
		}
	}, [reactions, dispatch]);

	useEffect(() => {
		const timers = reactionTimers.current;

		return () => {
			timers.forEach(window.clearTimeout);
			timers.clear();
		};
	}, []);

	function submit(event: FormEvent) {
		event.preventDefault();

		const text = draft.trim();

		if (!canSend || !text || pending) return;

		dispatch(setChatError({ roomId, message: "" }));

		const requestId = crypto.randomUUID();

		if (sendMessage({ roomId, text, requestId }, "CHAT_MESSAGE")) {
			followLatest.current = true;
			setPending({ text, requestId });
		} else {
			dispatch(
				setChatError({
					roomId,
					message: "Connection lost. Reload the page to reconnect.",
				}),
			);
		}
	}

	function react(emoji: string) {
		dispatch(setChatError({ roomId, message: "" }));

		if (!sendMessage({ roomId, emoji }, "CHAT_REACTION")) {
			dispatch(
				setChatError({
					roomId,
					message: "Connection lost. Reload the page to reconnect.",
				}),
			);
		}
	}

	return (
		<section
			aria-labelledby="room-chat-title"
			className="min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-background_light dark:bg-background_dark_secondary"
		>
			<header className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
				<h2 id="room-chat-title" className="font-semibold">
					Room chat
				</h2>
				<span className="text-xs text-zinc-500 dark:text-zinc-400">
					{!isConnected
						? "Disconnected"
						: ready
							? "Listening together"
							: "Joining chat…"}
				</span>
			</header>
			<div
				ref={listRef}
				role="log"
				aria-label="Room messages"
				aria-live="polite"
				aria-relevant="additions"
				onScroll={() => {
					const list = listRef.current;
					if (list)
						followLatest.current =
							list.scrollHeight - list.scrollTop - list.clientHeight < 60;
				}}
				className="h-64 overflow-y-auto overscroll-contain px-4 py-3 space-y-4"
			>
				{!messages.length && (
					<div className="flex h-full flex-col items-center justify-center text-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
						<span className="text-3xl" aria-hidden="true">
							🎵
						</span>
						<p>Good song? Tell the room.</p>
						<p className="text-xs">Chat stays here for this room session.</p>
					</div>
				)}
				{messages.map((message) => (
					<article key={message.id} className="min-w-0">
						<div className="flex items-baseline gap-2 text-xs">
							<span className="font-semibold text-accent dark:text-violet-300">
								{message.name}
								{message.userId === userId ? " (you)" : ""}
							</span>
							<time
								dateTime={message.createdAt}
								className="shrink-0 text-zinc-500 dark:text-zinc-400"
							>
								{new Date(message.createdAt).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})}
							</time>
						</div>
						<p className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
							{message.text}
						</p>
					</article>
				))}
			</div>
			<div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
				<div
					aria-live="polite"
					aria-label="Live reactions"
					className="flex min-h-7 gap-2 overflow-hidden text-xs text-zinc-600 dark:text-zinc-300"
				>
					{reactions.slice(-3).map((reaction) => (
						<span key={reaction.id} className="truncate">
							{reaction.emoji} {reaction.name}
						</span>
					))}
				</div>
				<div
					className="flex flex-wrap gap-1 mb-3"
					role="group"
					aria-label="React to the music"
				>
					{REACTIONS.map((emoji, index) => (
						<button
							key={emoji}
							type="button"
							disabled={!canSend}
							aria-label={`React with ${["love", "fire", "laughter", "applause", "music", "celebration"][index]}`}
							onClick={() => react(emoji)}
							className="rounded-lg px-3 py-2 text-xl hover:bg-background_light_secondary dark:hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{emoji}
						</button>
					))}
				</div>
				<form onSubmit={submit} className="flex items-end gap-2">
					<div className="min-w-0 flex-1">
						<label htmlFor="chat-message" className="sr-only">
							Message the room
						</label>
						<input
							id="chat-message"
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							maxLength={500}
							disabled={!canSend}
							placeholder={
								isConnected ? "Message the room…" : "Reload to reconnect"
							}
							autoComplete="off"
							aria-describedby="chat-feedback"
							className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
						/>
					</div>
					<button
						type="submit"
						disabled={!canSend || !draft.trim() || !!pending}
						className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						{pending ? "Sending…" : "Send"}
					</button>
				</form>
				<div
					id="chat-feedback"
					className="mt-2 flex justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400"
				>
					<span role="status">
						{error ||
							(!isConnected
								? "Connection lost. Reload to reconnect."
								: "Be kind. Enjoy the music.")}
					</span>
					<span className="shrink-0">{draft.length}/500</span>
				</div>
			</div>
		</section>
	);
}
