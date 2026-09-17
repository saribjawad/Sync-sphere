import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../app/hook";
import RoomChat from "../component/RoomChat";
import { openChat, closeChat } from "../features/chat/chat.slice";
import Navbar from "../component/Navbar";
import SongQueueDisplaySection from "../component/SongQueueDisplaySection";
import LoadingBar from "../component/ui/LoadingBar";
import YoutubeDisplaySection from "../component/YoutubeDisplaySection";
import { useGetLiveRoom } from "../customHooks/useGetLiveRoom";
import { selectLiveRoom } from "../features/liveRoom/liveRoom.slice";
import { useWebSocketContext } from "../contexts/webSocketProvider";
import { useParams } from "react-router-dom";
import { showToast } from "../utils/showToast";
import { selectUserInfo } from "../features/auth/auth.slice";

function LiveRoomPage() {
  const dispatch = useAppDispatch();
  const [activePanel, setActivePanel] = useState<"queue" | "chat">("queue");
  const [panelOpen, setPanelOpen] = useState(true);
  const [lastReadMessage, setLastReadMessage] = useState<string>();
  const latestMessage = useAppSelector(state => state.chat.messages[state.chat.messages.length - 1]?.id);
  const queueCount = useAppSelector(state => state.song.songQueue?.length || 0);

  useEffect(() => {
    if (panelOpen && activePanel === "chat") setLastReadMessage(latestMessage);
  }, [activePanel, panelOpen, latestMessage]);
  const { isLoading } = useGetLiveRoom();
  const liveRoom = useAppSelector(selectLiveRoom);
  const loggedInUser = useAppSelector(selectUserInfo);
  const { roomId } = useParams();
  const { isConnected, sendMessage } = useWebSocketContext();

  const isAdmin = liveRoom?.owner._id === loggedInUser?._id;

  useEffect(() => {
    if (roomId) dispatch(openChat(roomId));
    return () => { dispatch(closeChat()); };
  }, [roomId, dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isConnected && roomId) {
        const sent = sendMessage({ roomId }, "REFRESH_JOIN_ROOM");
        if (sent) {
          return;
        } else {
          console.warn("Failed to send message");
          showToast("error", "Connection issue. Please try again.");
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isConnected, roomId, sendMessage]);

  if (isLoading) {
    return (
      <div className="h-dvh w-full flex items-center justify-center dark:bg-background_dark bg-background_light ">
        <LoadingBar />
      </div>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col w-full bg-background_light dark:bg-background_dark text-text_light dark:text-text_dark  sm:px-5 sm:py-5 py-2 px-2">
      <Navbar
        variant="stream"
        username={liveRoom?.owner.name}
        isAdmin={isAdmin}
      />
      <div className="mx-auto w-full max-w-[1600px] px-1 py-4 sm:px-3 sm:py-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h1 className="truncate text-lg font-medium">{liveRoom?.roomName || "Listening room"}</h1>
          <button type="button" onClick={() => setPanelOpen(open => !open)} aria-expanded={panelOpen} aria-controls="room-panel" className="shrink-0 rounded-md px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent dark:text-zinc-400 dark:hover:bg-zinc-900">
            {panelOpen ? "Hide panel" : "Queue & chat"}
            {!panelOpen && latestMessage && latestMessage !== lastReadMessage && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-label="New chat messages" />}
          </button>
        </div>
        <div className={`grid items-start gap-6 ${panelOpen ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
          <YoutubeDisplaySection currentSong={liveRoom?.currentSong} isAdmin={isAdmin} />
          {/* Keep both panels mounted so switching tabs preserves drafts and queue state. */}
          <aside id="room-panel" aria-label="Room activity" className={`${panelOpen ? "flex" : "hidden"} h-[440px] min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 lg:h-[min(640px,calc(100dvh-200px))] lg:min-h-[400px]`}>
            <div className="flex shrink-0 border-b border-zinc-200 px-4 dark:border-zinc-800" role="group" aria-label="Choose room panel">
              {(["queue", "chat"] as const).map(panel => (
                <button key={panel} type="button" aria-pressed={activePanel === panel} onClick={() => setActivePanel(panel)} className={`relative flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${activePanel === panel ? "border-accent font-medium text-accent dark:text-violet-300" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
                  {panel === "queue" ? "Queue" : "Chat"}
                  {panel === "queue" && <span className="text-xs text-zinc-500 dark:text-zinc-400">{queueCount}</span>}
                  {panel === "chat" && latestMessage && latestMessage !== lastReadMessage && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="New messages" />}
                </button>
              ))}
            </div>
            <div className={`${activePanel === "queue" ? "flex" : "hidden"} min-h-0 flex-1 flex-col`}>
              <SongQueueDisplaySection />
            </div>
            <div className={`${activePanel === "chat" ? "flex" : "hidden"} min-h-0 flex-1 flex-col`}>
              {roomId && <RoomChat key={roomId} roomId={roomId} active={panelOpen && activePanel === "chat"} />}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default LiveRoomPage;
