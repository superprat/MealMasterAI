// Recipe photos and how-to videos. Shared by the API (validation) and the front end (rendering).

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

// The 11-character video id from any common YouTube link form, or null if it isn't one:
// youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID, m.youtube.com/...
export function youTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = parsed.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = parsed.pathname.split("/");
    if (first === "watch") id = parsed.searchParams.get("v");
    else if (first === "shorts" || first === "embed" || first === "live") id = second ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export const isYouTubeUrl = (url: string) => youTubeVideoId(url) !== null;

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

// Privacy-friendly embed: no cookies until the viewer presses play
export const youTubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
export const youTubeThumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youTubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youTubeSearchUrl = (recipeName: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${recipeName} recipe`)}`;
