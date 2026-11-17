import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { isHttpsUrl, isYouTubeUrl, youTubeSearchUrl } from "@shared/media";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecipeThumb } from "./recipe-media";

// Form fields for the recipe forms; blank means none
export const mediaFormSchema = {
  videoUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || isYouTubeUrl(v), "Paste a YouTube video link, like youtube.com/watch?v=…"),
  imageUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || isHttpsUrl(v), "Paste a link that starts with https://"),
};

type MediaFormValues = { name?: string; videoUrl: string; imageUrl: string };

interface RecipeMediaFieldsProps {
  // The parent form's register/errors; typed loosely so both recipe forms can share this
  register: UseFormRegister<any>;
  errors: FieldErrors<MediaFormValues>;
  values: MediaFormValues;
}

export function RecipeMediaFields({ register, errors, values }: RecipeMediaFieldsProps) {
  const name = values.name?.trim();
  const preview = {
    name: name || "Recipe",
    videoUrl: values.videoUrl && isYouTubeUrl(values.videoUrl) ? values.videoUrl : null,
    imageUrl: values.imageUrl && isHttpsUrl(values.imageUrl) ? values.imageUrl : null,
  };
  const hasPreview = !!(preview.videoUrl || preview.imageUrl);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg">Photo or video</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add a how-to video, a photo, or both, so everyone knows what they're making.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="videoUrl">YouTube video</Label>
              {name && (
                <a
                  href={youTubeSearchUrl(name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Search YouTube
                </a>
              )}
            </div>
            <Input
              id="videoUrl"
              type="url"
              inputMode="url"
              autoComplete="off"
              {...register("videoUrl")}
              placeholder="https://www.youtube.com/watch?v=…"
              className={errors.videoUrl ? "border-destructive" : ""}
              aria-invalid={!!errors.videoUrl}
            />
            {errors.videoUrl && <p className="text-sm text-destructive mt-1">{errors.videoUrl.message}</p>}
          </div>

          <div>
            <Label htmlFor="imageUrl">Photo link</Label>
            <Input
              id="imageUrl"
              type="url"
              inputMode="url"
              autoComplete="off"
              {...register("imageUrl")}
              placeholder="https://…/dish.jpg"
              className={errors.imageUrl ? "border-destructive" : ""}
              aria-invalid={!!errors.imageUrl}
            />
            {errors.imageUrl ? (
              <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Right-click a photo online and choose “Copy image address”. Without one, the video's thumbnail is used.
              </p>
            )}
          </div>
        </div>

        {hasPreview && <RecipeThumb recipe={preview} className="hidden sm:flex h-24 w-24 mt-6" />}
      </div>
    </div>
  );
}
