import { ExternalLink, Pencil, Trash2, Youtube } from "lucide-react";
import type { Recipe } from "@shared/schema";
import { youTubeSearchUrl, youTubeVideoId, youTubeWatchUrl } from "@shared/media";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { MEAL_TYPES } from "@/lib/meals";
import { cn, formatNumber } from "@/lib/utils";
import { RecipeHeroMedia } from "./recipe-media";

interface RecipeDetailsProps {
  recipe: Recipe | null;
  onClose: () => void;
  // Shown as an Edit button when given (the recipe library passes it; the planner doesn't)
  onEdit?: (recipe: Recipe) => void;
  onDelete?: (recipe: Recipe) => void;
}

export function MealTypeChips({ mealTypes }: { mealTypes: string[] }) {
  // A span so it can sit inside buttons (the library cards)
  return (
    <span className="flex flex-wrap items-center gap-1">
      {MEAL_TYPES.filter((m) => mealTypes.includes(m.type)).map((m) => (
        <span
          key={m.type}
          className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-foreground/80", m.soft)}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
          {m.label}
        </span>
      ))}
    </span>
  );
}

// Splits the free-text description into paragraphs (blank lines) and keeps single line breaks
function Method({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-3 max-w-[65ch] text-base leading-relaxed text-foreground">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

function RecipeBody({ recipe, onEdit, onDelete }: Omit<RecipeDetailsProps, "onClose"> & { recipe: Recipe }) {
  const videoId = youTubeVideoId(recipe.videoUrl);
  const macros = [
    { label: "Calories", value: formatNumber(recipe.calories), unit: "" },
    { label: "Protein", value: recipe.protein, unit: "g" },
    { label: "Carbs", value: recipe.carbs, unit: "g" },
    { label: "Fat", value: recipe.fats, unit: "g" },
  ];

  return (
    <div className="space-y-5">
      <RecipeHeroMedia key={recipe.id} recipe={recipe} />

      <dl className="grid grid-cols-4 divide-x divide-border rounded-lg border border-border tabular">
        {macros.map((m) => (
          <div key={m.label} className="px-2 py-2.5 text-center">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</dt>
            <dd className="mt-0.5 text-lg text-foreground">
              {m.value}
              <span className="text-sm text-muted-foreground">{m.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="recipe-method-heading">
        <h3 id="recipe-method-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How to make it
        </h3>
        {recipe.description?.trim() ? (
          <Method text={recipe.description} />
        ) : (
          <p className="text-sm text-muted-foreground">No method written down yet.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {videoId ? (
          <Button variant="outline" size="sm" asChild>
            <a href={youTubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Open in YouTube
            </a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <a href={youTubeSearchUrl(recipe.name)} target="_blank" rel="noopener noreferrer" data-testid="link-find-video">
              <Youtube />
              Find a video
            </a>
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(recipe)} data-testid={`button-edit-recipe-${recipe.id}`}>
            <Pencil />
            Edit recipe
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="sm:ml-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(recipe)}
            data-testid={`button-delete-recipe-${recipe.id}`}
          >
            <Trash2 />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

// Everything about one recipe: photo or video, macros and the method.
// A dialog on larger screens and a bottom sheet on phones, like the planner's recipe picker.
export function RecipeDetails({ recipe, onClose, onEdit, onDelete }: RecipeDetailsProps) {
  const isMobile = useIsMobile();
  const open = recipe !== null;
  const onOpenChange = (next: boolean) => !next && onClose();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto" data-testid="recipe-details">
          {recipe && (
            <>
              <SheetHeader className="text-left pr-8 mb-4 space-y-2">
                <SheetTitle className="font-display font-normal text-2xl leading-tight">{recipe.name}</SheetTitle>
                <SheetDescription asChild>
                  <div>
                    <MealTypeChips mealTypes={recipe.mealTypes} />
                  </div>
                </SheetDescription>
              </SheetHeader>
              <RecipeBody recipe={recipe} onEdit={onEdit} onDelete={onDelete} />
            </>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="recipe-details">
        {recipe && (
          <>
            <DialogHeader className="pr-8 space-y-2">
              <DialogTitle className="font-display font-normal text-2xl leading-tight">{recipe.name}</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <MealTypeChips mealTypes={recipe.mealTypes} />
                </div>
              </DialogDescription>
            </DialogHeader>
            <RecipeBody recipe={recipe} onEdit={onEdit} onDelete={onDelete} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
