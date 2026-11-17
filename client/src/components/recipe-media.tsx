import { useState } from "react";
import { Play, UtensilsCrossed } from "lucide-react";
import type { Recipe } from "@shared/schema";
import { youTubeEmbedUrl, youTubeThumbnailUrl, youTubeVideoId } from "@shared/media";
import { cn } from "@/lib/utils";

type MediaRecipe = Pick<Recipe, "name" | "imageUrl" | "videoUrl">;

// The picture to show for a recipe: its own photo, else its video's thumbnail
export function recipePictureUrl(recipe: MediaRecipe): string | null {
  if (recipe.imageUrl) return recipe.imageUrl;
  const videoId = youTubeVideoId(recipe.videoUrl);
  return videoId ? youTubeThumbnailUrl(videoId) : null;
}

// The recipe's picture at any size: give it a size or aspect ratio through className.
// Falls back to a plain plate icon when there is no picture or it fails to load, so
// lists keep the same shape either way. YouTube thumbnails are 4:3 with letterbox bars;
// object-cover in a 16:9 box crops the bars away.
export function RecipeThumb({
  recipe,
  className,
  showVideoBadge = false,
}: {
  recipe: MediaRecipe;
  className?: string;
  // A small play mark in the corner when the recipe has a video
  showVideoBadge?: boolean;
}) {
  const src = recipePictureUrl(recipe);
  const [failed, setFailed] = useState<string | null>(null);
  const show = src && failed !== src;
  const hasVideo = !!youTubeVideoId(recipe.videoUrl);

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center", className)}
      aria-hidden
    >
      {show ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        <UtensilsCrossed className="h-8 w-8 max-h-[33%] max-w-[33%] text-muted-foreground/50" />
      )}
      {showVideoBadge && hasVideo && show && (
        <span className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
          <Play className="ml-px h-3.5 w-3.5 fill-current" />
        </span>
      )}
    </div>
  );
}

// Large media at the top of the recipe details. A YouTube video shows its thumbnail
// with a play button and only loads the player when pressed (faster, and no YouTube
// requests until the viewer asks for the video). Renders nothing without media.
export function RecipeHeroMedia({ recipe }: { recipe: MediaRecipe }) {
  const videoId = youTubeVideoId(recipe.videoUrl);
  const [playing, setPlaying] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  if (videoId) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
        {playing ? (
          <iframe
            src={`${youTubeEmbedUrl(videoId)}&autoplay=1`}
            title={`How to make ${recipe.name}`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            // YouTube refuses to play embeds that send no referrer
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            aria-label={`Play video: how to make ${recipe.name}`}
            data-testid="button-play-video"
          >
            <img
              src={recipe.imageUrl || youTubeThumbnailUrl(videoId)}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/20" aria-hidden />
            <span
              className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_rgb(0_0_0/0.25)] transition-transform group-hover:scale-105 motion-reduce:transition-none"
              aria-hidden
            >
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </span>
          </button>
        )}
      </div>
    );
  }

  if (recipe.imageUrl && !imageFailed) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <img
          src={recipe.imageUrl}
          alt={recipe.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return null;
}
