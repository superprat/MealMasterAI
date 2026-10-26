import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ToastAction } from "@/components/ui/toast";
import { Plus, X, Search } from "lucide-react";
import { Recipe, MealType, DayOfWeek } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, formatNumber } from "@/lib/utils";
import { MEAL_TYPE_STYLE } from "@/lib/meals";

interface MealCardProps {
  weekStartDate: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  recipes?: Recipe[];
}

export function MealCard({ weekStartDate, dayOfWeek, mealType, recipes = [] }: MealCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const mealLabel = MEAL_TYPE_STYLE[mealType].label.toLowerCase();

  const { data: availableRecipes } = useQuery<Recipe[]>({
    queryKey: ['/api/recipes'],
  });

  const plannedIds = new Set(recipes.map((r) => r.id));
  const mealTypeRecipes = availableRecipes?.filter(r =>
    r.mealTypes?.includes(mealType) &&
    !plannedIds.has(r.id) &&
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const openRecipeSelector = () => setShowRecipeSelector(true);
  const closeRecipeSelector = () => {
    setShowRecipeSelector(false);
    setSearchTerm("");
  };

  const refreshPlan = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/meal-plans'] });
    queryClient.invalidateQueries({ queryKey: ['/api/macros'] });
  };

  const totalCalories = recipes.reduce((sum, recipe) => sum + recipe.calories, 0);

  // The new recipe showing up in the slot is the confirmation; toasts are for failures and undo
  const addRecipeMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      return apiRequest('POST', '/api/meal-plans', {
        weekStartDate,
        dayOfWeek,
        mealType,
        recipeId,
      });
    },
    onSuccess: () => {
      refreshPlan();
      closeRecipeSelector();
    },
    onError: () => {
      toast({
        title: "Couldn't add that recipe",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  const removeRecipeMutation = useMutation({
    mutationFn: async (recipe: Recipe) => {
      return apiRequest('DELETE', `/api/meal-plans/${weekStartDate}/${dayOfWeek}/${mealType}/${recipe.id}`);
    },
    onSuccess: (_, recipe) => {
      refreshPlan();
      toast({
        title: `Removed ${recipe.name}`,
        action: (
          <ToastAction altText={`Put ${recipe.name} back`} onClick={() => addRecipeMutation.mutate(recipe.id)}>
            Undo
          </ToastAction>
        ),
      });
    },
    onError: () => {
      toast({
        title: "Couldn't remove that recipe",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  const moveRecipeMutation = useMutation({
    mutationFn: async ({
      recipeId,
      fromWeek,
      fromDay,
      fromMeal,
      toDay,
      toMeal
    }: {
      recipeId: number;
      fromWeek: string;
      fromDay: DayOfWeek;
      fromMeal: MealType;
      toDay: DayOfWeek;
      toMeal: MealType;
    }) => {
      // Add to destination first so a failure never loses the recipe
      await apiRequest('POST', '/api/meal-plans', {
        weekStartDate,
        dayOfWeek: toDay,
        mealType: toMeal,
        recipeId,
      });
      return apiRequest('DELETE', `/api/meal-plans/${fromWeek}/${fromDay}/${fromMeal}/${recipeId}`);
    },
    onSuccess: refreshPlan,
    onError: () => {
      toast({
        title: "Couldn't move that recipe",
        description: "It's still in its original slot. Try again.",
        variant: "destructive",
      });
    },
  });

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, recipe: Recipe) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      recipeId: recipe.id,
      recipeName: recipe.name,
      fromWeek: weekStartDate,
      fromDay: dayOfWeek,
      fromMeal: mealType
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggedOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset when leaving the card entirely, not when crossing a child
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDraggedOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggedOver(false);

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { recipeId, fromDay, fromMeal } = dragData;
      const fromWeek: string = dragData.fromWeek ?? weekStartDate;

      if (fromWeek === weekStartDate && fromDay === dayOfWeek && fromMeal === mealType) {
        return;
      }

      moveRecipeMutation.mutate({
        recipeId,
        fromWeek,
        fromDay,
        fromMeal,
        toDay: dayOfWeek,
        toMeal: mealType
      });
    } catch (error) {
      console.error('Failed to parse drag data:', error);
    }
  };

  // A render function, not a component, so the search input keeps focus while typing
  const renderRecipePicker = (variant: "desktop" | "mobile") => (
    <div className="flex flex-col min-h-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder={`Search ${mealLabel} recipes`}
          aria-label={`Search ${mealLabel} recipes`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={cn("pl-9", variant === "mobile" ? "h-11 text-base" : "h-9 text-sm")}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          data-testid={variant === "mobile" ? "input-recipe-search" : "input-recipe-search-desktop"}
        />
      </div>
      <div className={cn("mt-2 -mx-1 overflow-y-auto", variant === "mobile" ? "max-h-[55vh]" : "max-h-72")}>
        {mealTypeRecipes.length > 0 ? (
          <ul className="space-y-0.5">
            {mealTypeRecipes.map((recipe) => (
              <li key={recipe.id}>
                <button
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent focus-visible:bg-accent focus-visible:outline-none transition-colors disabled:opacity-50"
                  onClick={() => addRecipeMutation.mutate(recipe.id)}
                  disabled={addRecipeMutation.isPending}
                  data-testid={`button-select-recipe-${recipe.id}`}
                >
                  <div className={cn("font-medium text-foreground", variant === "mobile" ? "text-base" : "text-sm")}>{recipe.name}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {formatNumber(recipe.calories)} cal · {recipe.protein}g protein
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {searchTerm
              ? <>No {mealLabel} recipes match “{searchTerm}”.</>
              : <>No more {mealLabel} recipes to add.</>}
            <div className="mt-2">
              <Link href="/recipes" className="font-medium text-primary underline-offset-4 hover:underline">
                Add one in Recipes
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const isEmpty = recipes.length === 0;

  return (
    <Popover open={showRecipeSelector && !isMobile} onOpenChange={(open) => (open ? openRecipeSelector() : closeRecipeSelector())}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "h-full min-h-[3.25rem] sm:min-h-[5.5rem] rounded-lg transition-colors",
            isDraggedOver && "ring-2 ring-primary bg-primary/5",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid={`meal-slot-${dayOfWeek}-${mealType}`}
        >
          {isEmpty ? (
            <button
              type="button"
              onClick={openRecipeSelector}
              className="group w-full h-full min-h-[3.25rem] sm:min-h-[5.5rem] rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors flex items-center justify-center gap-1.5"
              aria-label={`Add ${mealLabel}`}
              data-testid={`button-add-${mealType}`}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 h-full">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="group/recipe relative rounded-md bg-background border border-border px-2.5 py-2 cursor-grab active:cursor-grabbing hover:border-foreground/20 transition-colors"
                  draggable
                  onDragStart={(e) => handleDragStart(e, recipe)}
                >
                  <div className="pr-6 text-sm font-medium leading-snug text-foreground break-words">{recipe.name}</div>
                  <div className="text-xs text-muted-foreground tabular mt-0.5">
                    {formatNumber(recipe.calories)} cal · {recipe.protein}g protein
                  </div>
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring opacity-100 sm:opacity-0 sm:group-hover/recipe:opacity-100 sm:focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                    onClick={() => removeRecipeMutation.mutate(recipe)}
                    aria-label={`Remove ${recipe.name}`}
                    data-testid={`button-remove-recipe-${recipe.id}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={openRecipeSelector}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                  aria-label={`Add another recipe to ${mealLabel}`}
                  data-testid={`button-add-more-${mealType}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add
                </button>
                {recipes.length > 1 && (
                  <span className="text-xs text-muted-foreground tabular">{formatNumber(totalCalories)} cal</span>
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent align="start" className="w-80 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        {renderRecipePicker("desktop")}
      </PopoverContent>

      {isMobile && (
        <Sheet open={showRecipeSelector} onOpenChange={(open) => !open && closeRecipeSelector()}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] flex flex-col gap-3">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display font-normal text-xl">Add to {mealLabel}</SheetTitle>
              <SheetDescription className="sr-only">Pick a recipe from your library</SheetDescription>
            </SheetHeader>
            {renderRecipePicker("mobile")}
          </SheetContent>
        </Sheet>
      )}
    </Popover>
  );
}
