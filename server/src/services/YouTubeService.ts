import { z } from "zod";
// The existing keyless lookup remains available for local development.
// @ts-ignore — this package does not provide TypeScript declarations.
import youtubeSearch from "youtube-search-api";
import { YOUTUBE_API_KEY } from "../config/config.js";

const detailsSchema = z.object({ title: z.string().min(1), channel: z.string().min(1) });
const responseSchema = z.object({
  items: z.array(z.object({
    snippet: z.object({ title: z.string().min(1), channelTitle: z.string().min(1) }),
  })),
});

export async function getYouTubeDetails(videoId: string) {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error("Please enter a valid YouTube video URL.");

  if (!YOUTUBE_API_KEY) {
    try {
      return detailsSchema.parse(await youtubeSearch.GetVideoDetails(videoId));
    } catch {
      throw new Error("YouTube video details are unavailable. Please try again later.");
    }
  }

  // Use the supported metadata API rather than scraping YouTube's watch page.
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({
    part: "snippet", id: videoId, key: YOUTUBE_API_KEY,
    fields: "items(snippet(title,channelTitle))",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    // Never propagate a fetch error that could include the API key in its URL.
    throw new Error("Could not reach YouTube. Please try again shortly.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const reasons = body?.error?.errors?.map((error: { reason?: string }) => error.reason) || [];
    if (response.status === 429 || reasons.some((reason: string) => ["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"].includes(reason))) {
      throw new Error("YouTube's request limit has been reached. Please try again later.");
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      console.error("YouTube API configuration rejected; check API enablement and key restrictions.");
      throw new Error("Video lookup is unavailable. Please contact the app owner.");
    }
    throw new Error("YouTube video details are unavailable. Please try again later.");
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new Error("YouTube returned invalid video details. Please try again later.");
  const video = parsed.data.items[0];
  if (!video) throw new Error("Video not found or unavailable. Try a public YouTube video.");
  return { title: video.snippet.title, channel: video.snippet.channelTitle };
}
