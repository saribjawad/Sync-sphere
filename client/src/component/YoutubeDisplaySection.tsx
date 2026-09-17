import { useEffect, useRef, useState } from "react";
import Button from "./Button";
import { SongType } from "../schemas/songSchema";
import { useWebSocketContext } from "../contexts/webSocketProvider";
import { showToast } from "../utils/showToast";
import { useAppDispatch, useAppSelector } from "../app/hook";
import { selectSongQueue } from "../features/song/song.slice";
import { useParams } from "react-router-dom";
import { FaUser } from "react-icons/fa6";
import {
  selectNoOfJoinedUser,
  setCurrentSong,
} from "../features/liveRoom/liveRoom.slice";
import SyncToInfo from "./SyncToInfo";
import { selectUserInfo } from "../features/auth/auth.slice";
import { useLoadingContext } from "../contexts/loadingActionProvider";
import LoadingBar from "./ui/LoadingBar";

// youtube iframe api types
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface IYoutubeDisplaySectionProps {
  currentSong: SongType | null | undefined;
  isAdmin: boolean;
}

function YoutubeDisplaySection({
  currentSong,
  isAdmin,
}: IYoutubeDisplaySectionProps) {
  const { isLoading, startLoading } = useLoadingContext();
  const playerContainer = useRef<HTMLDivElement>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isSyncToInfoOpen, setIsSyncToInfoOpen] = useState(false);
  const youtubePlayer = useRef<YT.Player>();
  const songsQueue = useAppSelector(selectSongQueue);
  const roomTimestamps = useAppSelector(
    (state) => state.liveRoom.liveRoomTimestamps
  );
  const dispatch = useAppDispatch();
  const songsQueueRef = useRef(songsQueue);
  const noOfJoinedUser = useAppSelector(selectNoOfJoinedUser);
  const userInfo = useAppSelector(selectUserInfo);

  const { isConnected, sendMessage } = useWebSocketContext();
  const { roomId } = useParams();

  useEffect(() => {
    songsQueueRef.current = songsQueue;
  }, [songsQueue]);

  useEffect(() => {
    // loads the IFrame Player API
    if (!currentSong?.externalId) return;

    if (youtubePlayer?.current) {
      youtubePlayer.current.loadVideoById(currentSong.externalId);
      return;
    }

    if (!window.YT) {
      if (document.getElementById("youtube-iframe-script")) return;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.id = "youtube-iframe-script";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initializeYoutubePlayer();
      };
    } else {
      initializeYoutubePlayer();
    }
  }, [currentSong?.externalId]);

  const initializeYoutubePlayer = () => {
    if (youtubePlayer.current || !playerContainer.current) return;

    youtubePlayer.current = new window.YT.Player(playerContainer.current!, {
      height: "100%",
      width: "100%",
      videoId: currentSong?.externalId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        autohide: 1,
      },
      events: {
        onReady: () => {
          setIsPlayerReady(true);
        },
        onStateChange: (e) => {
          const playerStatus = e.target.getPlayerState();

          if (playerStatus === 1) {
            setIsPlayerReady(true);
          } else {
            setIsPlayerReady(false);
          }
        },
      },
    });
  };

  //   handle play next
  const handlePlayNext = () => {
    if (songsQueueRef.current.length <= 0) {
      dispatch(setCurrentSong(null));
      return showToast("emoji", "Add more songs in queue to play.");
    }

    startLoading("playNext");
    const sent = sendMessage(
      { songId: songsQueueRef.current[0]._id, roomId },
      "PLAY_NEXT_SONG"
    );
    if (sent) {
      return;
    } else if (isConnected) {
      console.warn(
        "Failed to send message even though connection is established"
      );
    } else {
      showToast("error", "Something went wrong! Try again.");
    }
  };

  //   handle sync all
  const handleSyncAll = (userTimestamps?: number) => {
    const timestamps =
      userTimestamps ?? youtubePlayer.current?.getCurrentTime();

    if (timestamps === undefined) {
      return showToast("error", "Could not get timestamp!");
    }

    const sent = sendMessage({ timestamps, roomId }, "SYNC_ALL");
    if (sent) {
      setIsSyncToInfoOpen(false);
      return;
    } else if (isConnected) {
      console.warn(
        "Failed to send message even though connection is established"
      );
    } else {
      showToast("error", "Something went wrong! Try again.");
    }
  };

  //   send timestamps every second
  useEffect(() => {
    if (!youtubePlayer.current || !isPlayerReady || isAdmin) return;

    const interval = setInterval(() => {
      let timestamps = youtubePlayer.current?.getCurrentTime();
      if (timestamps !== undefined) {
        timestamps = Math.floor(timestamps);
      }

      const sent = sendMessage(
        { roomId, timestamps, userId: userInfo?._id, username: userInfo?.name },
        "TIMESTAMPS"
      );

      if (sent) {
        return;
      } else if (isConnected) {
        console.warn(
          "Failed to send message even though connection is established"
        );
      } else {
        showToast("error", "Something went wrong! Try again.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isConnected,
    roomId,
    userInfo,
    currentSong?.externalId,
    isPlayerReady,
    isAdmin,
  ]);

  useEffect(() => {
    if (!roomTimestamps) return;

    youtubePlayer.current?.seekTo(roomTimestamps, true);
  }, [roomTimestamps]);

  return (
    <section className=" xl:flex-1  flex flex-col gap-3">
      {/* stream buttons */}
      <div className="flex items-center justify-between">
        <div className="text-sm flex items-center gap-2 justify-center">
          <FaUser />
          <span>{noOfJoinedUser}</span>
        </div>
        {currentSong && isAdmin && (
          <div className="flex items-center gap-2 justify-end">
            <Button onClick={() => handleSyncAll()} size="sm">
              Sync All
            </Button>
            <Button
              onClick={() => setIsSyncToInfoOpen(!isSyncToInfoOpen)}
              size="sm"
            >
              Sync To
            </Button>
          </div>
        )}
      </div>

      <div className="aspect-video xl:aspect-auto xl:h-[90%] w-full  relative">
        <SyncToInfo handleSyncAll={handleSyncAll} isOpen={isSyncToInfoOpen} />

        {!currentSong ? (
          <div className="h-full w-full flex items-center justify-center sm:text-base text-sm  ">
            No current video/song playing right now, Add video/songs to play!
          </div>
        ) : (
          <div
            ref={playerContainer}
            id="video-container "
            className="w-full h-full"
          ></div>
        )}
      </div>

      <div className="flex items-center justify-between  h-fit">
        <div className="">
          <h1 className="md:text-base text-sm">{currentSong?.title}</h1>
          <span className="md:text-sm text-xs text-text_dark_secondary dark:text-zinc-500">
            {currentSong?.artist}
          </span>
        </div>

        {isAdmin && currentSong && (
          <Button onClick={handlePlayNext} size="sm" className="flex-shrink-0">
            {isLoading("playNext") ? <LoadingBar size="xs" /> : "Play next"}
          </Button>
        )}
      </div>
    </section>
  );
}

export default YoutubeDisplaySection;
