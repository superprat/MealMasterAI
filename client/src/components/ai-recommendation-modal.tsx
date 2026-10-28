import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChefHat, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatShortDate, parseDateKey } from "@/lib/dates";
import { DAY_NAMES as DAYS, MEAL_TYPE_STYLE } from "@/lib/meals";
import { cn } from "@/lib/utils";
import type { MealType } from "@shared/schema";

interface AIRecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekStartDate: string;
}

interface MealPlanSuggestion {
  dayOfWeek: number;
  mealType: string;
  suggestedRecipeId?: number;
  newRecipe?: {
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    mealType: string;
  };
  reasoning: string;
}

// Helper function to format week date range for display
function formatWeekDateRange(weekStartDate: string): string {
  const endDate = addDays(weekStartDate, 6);
  const start = parseDateKey(weekStartDate);
  const end = parseDateKey(endDate);
  
  // If same month, show "Aug 11 - 17"; otherwise "Aug 28 - Sep 3"
  if (start.getMonth() === end.getMonth()) {
    return `${formatShortDate(weekStartDate)} – ${end.getDate()}`;
  }
  return `${formatShortDate(weekStartDate)} – ${formatShortDate(endDate)}`;
}

export function AIRecommendationModal({ isOpen, onClose, weekStartDate }: AIRecommendationModalProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [suggestions, setSuggestions] = useState<MealPlanSuggestion[]>([]);
  const [excludedRecipes, setExcludedRecipes] = useState<Record<string, number[]>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Suggestions belong to one week; drop them when the week changes or the modal closes
  useEffect(() => {
    if (!isOpen) {
      setSuggestions([]);
      setSelectedSuggestions(new Set());
      setExcludedRecipes({});
    }
  }, [isOpen, weekStartDate]);

  // Fetch recipes to lookup names
  const { data: recipesData } = useQuery({
    queryKey: ['/api/recipes'],
  });

  // Helper function to get recipe name by ID
  const getRecipeName = (recipeId: number): string => {
    if (!recipesData || !Array.isArray(recipesData)) return `Recipe ID: ${recipeId}`;
    
    const recipe = recipesData.find((r: any) => r.id === recipeId);
    return recipe ? recipe.name : `Recipe ID: ${recipeId}`;
  };

  // Generate AI suggestions
  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/ai/generate-meal-plan', {
        weekStartDate,
        preferences: [],
        restrictions: [],
      });
    },
    onSuccess: async (response) => {
      // Suggestions can use recipes added since the list was cached, so refetch it before showing names
      const [data] = await Promise.all([
        response.json(),
        queryClient.invalidateQueries({ queryKey: ['/api/recipes'] }),
      ]);
      setSuggestions(data);
      setExcludedRecipes({});
    },
    onError: () => {
      toast({
        title: "Couldn't get suggestions",
        description: "The suggestion service didn't answer. Try again in a moment.",
        variant: "destructive",
      });
    },
  });

  // Get alternative recipe from existing recipes
  const getAlternativeRecipe = (dayOfWeek: number, mealType: string, currentRecipeId?: number) => {
    if (!recipesData || !Array.isArray(recipesData)) return null;
    
    // Filter recipes by meal type and exclude current suggestion
    // Note: recipes have mealTypes as an array, so we need to check if mealType is included
    const availableRecipes = recipesData.filter((recipe: any) => 
      recipe.mealTypes && 
      Array.isArray(recipe.mealTypes) && 
      recipe.mealTypes.includes(mealType) && 
      recipe.isApproved && 
      recipe.id !== currentRecipeId
    );
    
    const slotKey = `${dayOfWeek}-${mealType}`;
    const excluded = excludedRecipes[slotKey] || [];
    
    // Further exclude previously shown recipes for this slot
    const filteredRecipes = availableRecipes.filter((recipe: any) => 
      !excluded.includes(recipe.id)
    );
    
    // If we've shown all recipes, reset and start over
    if (filteredRecipes.length === 0 && availableRecipes.length > 0) {
      setExcludedRecipes(prev => ({ ...prev, [slotKey]: [] }));
      return availableRecipes[0];
    }
    
    return filteredRecipes[0] || null;
  };
  
  const handleAlternativeSelection = (dayOfWeek: number, mealType: string, currentRecipeId?: number) => {
    const alternativeRecipe = getAlternativeRecipe(dayOfWeek, mealType, currentRecipeId);
    
    if (!alternativeRecipe) {
      toast({
        title: "No other recipes to try",
        description: "Add more recipes for this meal in the library.",
      });
      return;
    }
    
    const slotKey = `${dayOfWeek}-${mealType}`;
    
    // Update suggestions list
    setSuggestions(prev => {
      const updated = prev.map(s => 
        s.dayOfWeek === dayOfWeek && s.mealType === mealType 
          ? {
              ...s,
              suggestedRecipeId: alternativeRecipe.id,
              newRecipe: undefined,
              reasoning: alternativeRecipe.description || "From your recipe library."
            }
          : s
      );
      return updated;
    });
    
    // Track excluded recipes to avoid repeating them
    setExcludedRecipes(prev => {
      const current = prev[slotKey] || [];
      const newExcluded = currentRecipeId ? [...current, currentRecipeId] : current;
      return { ...prev, [slotKey]: newExcluded };
    });
  };

  // Create new recipe
  const createRecipeMutation = useMutation({
    mutationFn: async (recipe: any) => {
      try {
        const response = await apiRequest('POST', '/api/recipes', {
          ...recipe,
          isAiSuggested: true,
          isApproved: true, // Auto-approve for demo
          maxWeeklyUses: 3,
        });
        return await response.json();
      } catch (error) {
        // The library already has a recipe with this name: plan that one instead of a copy
        const message = error instanceof Error ? error.message : "";
        if (message.startsWith("409: ")) {
          return JSON.parse(message.slice(5)).recipe;
        }
        throw error;
      }
    },
  });

  // Add meal to plan
  const addMealMutation = useMutation({
    mutationFn: async ({ recipeId, dayOfWeek, mealType }: {
      recipeId: number;
      dayOfWeek: number;
      mealType: string;
    }) => {
      return apiRequest('POST', '/api/meal-plans', {
        weekStartDate,
        dayOfWeek,
        mealType,
        recipeId,
      });
    },
  });

  const handleGenerateSuggestions = () => {
    generateSuggestionsMutation.mutate();
  };

  const handleApplySuggestions = async () => {
    if (!suggestions.length) return;
    
    const selectedSuggestionsList = suggestions.filter((_: any, index: number) => 
      selectedSuggestions.has(index)
    );

    if (selectedSuggestionsList.length === 0) {
      toast({
        title: "Pick at least one meal to add",
      });
      return;
    }

    try {
      for (const suggestion of selectedSuggestionsList) {
        let recipeId = suggestion.suggestedRecipeId;

        // If it's a new recipe, create it first
        if (suggestion.newRecipe) {
          const { mealType, ...recipe } = suggestion.newRecipe;
          const newRecipeData = await createRecipeMutation.mutateAsync({ ...recipe, mealTypes: [mealType] });
          recipeId = newRecipeData.id;
        }

        // Add to meal plan
        if (recipeId) {
          await addMealMutation.mutateAsync({
            recipeId,
            dayOfWeek: suggestion.dayOfWeek,
            mealType: suggestion.mealType,
          });
        }
      }

      toast({
        title: `Added ${selectedSuggestions.size} ${selectedSuggestions.size === 1 ? "meal" : "meals"} to your plan`,
      });

      setSelectedSuggestions(new Set());
      onClose();
    } catch (error) {
      console.error('Error applying suggestions:', error);
      toast({
        title: "Some meals weren't added",
        description: "The ones that saved are in your plan. Try the rest again.",
        variant: "destructive",
      });
    } finally {
      // Refresh even after a partial failure so already-saved meals show up
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans', weekStartDate] });
      queryClient.invalidateQueries({ queryKey: ['/api/macros', weekStartDate] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
    }
  };

  const toggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const isLoading = generateSuggestionsMutation.isPending;
  const isApplying = createRecipeMutation.isPending || addMealMutation.isPending;

  const daySections = DAYS.map((dayName, dayIndex) => ({
    dayName,
    dayIndex,
    items: suggestions
      .map((suggestion, index) => ({ suggestion, index }))
      .filter(({ suggestion }) => suggestion.dayOfWeek === dayIndex),
  })).filter((section) => section.items.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border text-left">
          <DialogTitle className="font-display font-normal text-2xl">Suggest meals</DialogTitle>
          <DialogDescription>
            For the week of {formatWeekDateRange(weekStartDate)}. Nothing changes until you add the ones you like.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {!suggestions.length && !isLoading && (
              <div className="py-6">
                <p className="text-foreground max-w-md">
                  Claude looks at what's already planned this week, your daily targets and your recipe library, then fills the gaps. It may also invent a few new recipes.
                </p>
                <Button onClick={handleGenerateSuggestions} disabled={isLoading} className="mt-5" data-testid="button-generate-suggestions">
                  <ChefHat />
                  Suggest meals
                </Button>
              </div>
            )}

            {isLoading && (
              <div className="space-y-4" aria-busy="true">
                <p className="text-sm text-muted-foreground" role="status">Putting a plan together. This can take up to a minute…</p>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-lg border border-border p-4">
                    <Skeleton className="h-4 w-1/3 mb-2" />
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <p className="text-sm text-muted-foreground">
                    {suggestions.length} suggestions. Tick the ones to add.
                  </p>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSuggestions(new Set(suggestions.map((_, i) => i)))}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSuggestions(new Set())}
                      disabled={selectedSuggestions.size === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {daySections.map(({ dayName, dayIndex, items }) => (
                    <section key={dayIndex}>
                      <h3 className="font-display text-lg text-foreground mb-2">
                        {dayName}
                        <span className="ml-2 text-sm font-sans text-muted-foreground">{formatShortDate(addDays(weekStartDate, dayIndex))}</span>
                      </h3>
                      <ul className="space-y-2">
                        {items.map(({ suggestion, index }) => {
                          const selected = selectedSuggestions.has(index);
                          const meal = MEAL_TYPE_STYLE[suggestion.mealType as MealType];
                          const checkboxId = `suggestion-${index}`;
                          return (
                            <li
                              key={index}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 sm:p-4 transition-colors",
                                selected ? "border-primary bg-primary/5" : "border-border hover:border-foreground/25",
                              )}
                            >
                              <Checkbox
                                id={checkboxId}
                                checked={selected}
                                onCheckedChange={() => toggleSuggestion(index)}
                                className="mt-0.5"
                                data-testid={`checkbox-suggestion-${index}`}
                              />
                              <label htmlFor={checkboxId} className="flex-1 min-w-0 cursor-pointer">
                                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {meal && <span className={cn("h-1.5 w-1.5 rounded-full", meal.dot)} aria-hidden />}
                                  {meal?.label ?? suggestion.mealType}
                                </span>
                                {suggestion.newRecipe ? (
                                  <>
                                    <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
                                      <span className="font-medium text-foreground">{suggestion.newRecipe.name}</span>
                                      <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">New recipe</span>
                                    </span>
                                    <span className="mt-0.5 block text-sm text-muted-foreground">{suggestion.newRecipe.description}</span>
                                    <span className="mt-1 block text-xs text-muted-foreground tabular">
                                      {suggestion.newRecipe.calories} cal · {suggestion.newRecipe.protein}g protein · {suggestion.newRecipe.carbs}g carbs · {suggestion.newRecipe.fats}g fat
                                    </span>
                                  </>
                                ) : (
                                  <span className="mt-1 block font-medium text-foreground">
                                    {getRecipeName(suggestion.suggestedRecipeId!)}
                                  </span>
                                )}
                                <span className="mt-1.5 block text-sm text-foreground/70">{suggestion.reasoning}</span>
                              </label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleAlternativeSelection(
                                    suggestion.dayOfWeek,
                                    suggestion.mealType,
                                    suggestion.suggestedRecipeId
                                  )
                                }
                                className="shrink-0 h-8 px-2 text-muted-foreground hover:text-foreground"
                                aria-label={`Try a different ${meal?.label.toLowerCase() ?? "recipe"} for ${dayName}`}
                                data-testid={`button-different-${index}`}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Different</span>
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="border-t border-border bg-background px-6 py-4 rounded-b-lg">
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <Button variant="outline" onClick={onClose} className="order-2 sm:order-1" data-testid="button-cancel">
                  Cancel
                </Button>
                <Button
                  onClick={handleApplySuggestions}
                  disabled={selectedSuggestions.size === 0 || isApplying}
                  className="order-1 sm:order-2"
                  data-testid="button-apply-suggestions"
                >
                  {isApplying
                    ? "Adding…"
                    : selectedSuggestions.size === 0
                      ? "Pick meals to add"
                      : `Add ${selectedSuggestions.size} ${selectedSuggestions.size === 1 ? "meal" : "meals"} to plan`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
