import { useAppSelector } from "../app/hook";
import { useGetSongQueue } from "../customHooks/useGetSongQueue";
import { selectSongQueue } from "../features/song/song.slice";
import AddSongSection from "./AddSongSection";
import SongQueueList from "./SongQueueList";
import LoadingBar from "./ui/LoadingBar";


function SongQueueDisplaySection() {
  const { isLoading } = useGetSongQueue();
  const songQueue = useAppSelector(selectSongQueue);

  return (
    <section aria-label="Song queue" className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 p-3"><AddSongSection /></div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center"><LoadingBar /></div>
        ) : songQueue?.length ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {songQueue.map(song => <SongQueueList key={song._id} song={song} />)}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
            <p>What’s playing next?</p>
            <p className="text-xs">Paste a YouTube link to add a song.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default SongQueueDisplaySection;
