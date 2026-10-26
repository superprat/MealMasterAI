import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatShortDate, parseDateKey } from "@/lib/dates";

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper function to format week date range for display
function formatWeekDateRange(weekStartDate: string): string {
  const endDate = addDays(weekStartDate, 6);
  const start = parseDateKey(weekStartDate);
  const end = parseDateKey(endDate);
  
  // If same month, show "Aug 11 - 17"; otherwise "Aug 28 - Sep 3"
  if (start.getMonth() === end.getMonth()) {
    return `${formatShortDate(weekStartDate)} - ${end.getDate()}`;
  }
  return `${formatShortDate(weekStartDate)} - ${formatShortDate(endDate)}`;
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
      const data = await response.json();
      setSuggestions(data);
      setExcludedRecipes({});
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate meal plan suggestions. Please check your AI service configuration.",
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
        title: "No Alternatives",
        description: "No other recipes available for this meal type.",
        variant: "destructive",
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
              reasoning: `Alternative suggestion: ${alternativeRecipe.description}`
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
      return apiRequest('POST', '/api/recipes', {
        ...recipe,
        isAiSuggested: true,
        isApproved: true, // Auto-approve for demo
        maxWeeklyUses: 3,
      });
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
        title: "No Suggestions Selected",
        description: "Please select at least one suggestion to apply.",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const suggestion of selectedSuggestionsList) {
        let recipeId = suggestion.suggestedRecipeId;

        // If it's a new recipe, create it first
        if (suggestion.newRecipe) {
          const { mealType, ...recipe } = suggestion.newRecipe;
          const newRecipeResponse = await createRecipeMutation.mutateAsync({ ...recipe, mealTypes: [mealType] });
          const newRecipeData = await newRecipeResponse.json();
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
        title: "Success",
        description: `Applied ${selectedSuggestions.size} meal suggestions to your plan.`,
      });

      setSelectedSuggestions(new Set());
      onClose();
    } catch (error) {
      console.error('Error applying suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to apply some suggestions. Please try again.",
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="flex items-center">
            <Sparkles className="text-primary mr-2" />
            AI Meal Plan Suggestions
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Week of {formatWeekDateRange(weekStartDate)}
          </p>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!suggestions.length && !isLoading && (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Let AI analyze your current meal plan and suggest improvements to better meet your nutritional goals.
              </p>
              <Button 
                onClick={handleGenerateSuggestions}
                disabled={isLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Suggestions
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">AI is analyzing your meal plan...</div>
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </Card>
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-600">
                  AI has generated a complete meal plan for the remaining days of the week. Select the meals you'd like to add to your plan:
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedSuggestions(new Set(suggestions.map((_, i) => i)))}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedSuggestions(new Set())}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Group suggestions by day */}
                {DAYS.map((dayName, dayIndex) => {
                  const daySuggestions = suggestions
                    .map((suggestion, index) => ({ suggestion, index }))
                    .filter(({ suggestion }) => suggestion.dayOfWeek === dayIndex);
                  
                  if (daySuggestions.length === 0) return null;
                  
                  // Calculate the specific date for this day
                  const dayFormatted = formatShortDate(addDays(weekStartDate, dayIndex));
                  
                  return (
                    <div key={dayIndex} className="border rounded-lg p-4 bg-gray-50/50">
                      <h3 className="font-semibold text-lg mb-3 text-gray-800 border-b pb-2">
                        {dayName} ({dayFormatted})
                      </h3>
                      
                      <div className="space-y-3">
                        {daySuggestions.map(({ suggestion, index }) => (
                          <Card 
                            key={index}
                            className={`p-4 cursor-pointer transition-all duration-200 ${
                              selectedSuggestions.has(index) 
                                ? 'border-primary bg-green-50 shadow-md' 
                                : 'hover:bg-white hover:shadow-sm border-gray-200'
                            }`}
                            onClick={() => toggleSuggestion(index)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm mb-2 text-primary capitalize">
                                  {suggestion.mealType}
                                </div>
                                
                                {suggestion.newRecipe ? (
                                  <div className="text-sm mb-2">
                                    <div className="font-medium text-green-600 mb-1">
                                      New Recipe: {suggestion.newRecipe.name}
                                    </div>
                                    <div className="text-xs text-gray-600 mb-2">
                                      {suggestion.newRecipe.description}
                                    </div>
                                    <div className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-1 inline-block">
                                      {suggestion.newRecipe.calories} cal • {suggestion.newRecipe.protein}g protein • {suggestion.newRecipe.carbs}g carbs • {suggestion.newRecipe.fats}g fat
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm text-blue-600 mb-2 font-medium">
                                    {getRecipeName(suggestion.suggestedRecipeId!)}
                                  </div>
                                )}
                                
                                <div className="text-xs text-gray-600 italic mt-2">
                                  {suggestion.reasoning}
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2 ml-4">
                                <Button
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAlternativeSelection(
                                      suggestion.dayOfWeek, 
                                      suggestion.mealType,
                                      suggestion.suggestedRecipeId
                                    );
                                  }}
                                  className="text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Different
                                </Button>
                                
                                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                  selectedSuggestions.has(index)
                                    ? 'bg-primary border-primary'
                                    : 'border-gray-300 hover:border-primary/50'
                                }`}>
                                  {selectedSuggestions.has(index) && (
                                    <div className="text-white text-xs font-bold">✓</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

            </>
          )}
          </div>

          {/* Sticky Action Buttons */}
          {suggestions.length > 0 && (
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <Button variant="outline" onClick={onClose} className="order-2 sm:order-1" data-testid="button-cancel">
                  Cancel
                </Button>
                <Button 
                  onClick={handleApplySuggestions}
                  disabled={selectedSuggestions.size === 0 || isApplying}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 order-1 sm:order-2"
                  data-testid="button-apply-suggestions"
                >
                  {isApplying ? 'Applying...' : `Apply ${selectedSuggestions.size} Suggestions`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
