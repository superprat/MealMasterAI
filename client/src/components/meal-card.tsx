import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { Plus, X, Search } from "lucide-react";
import { Recipe, MealType, DayOfWeek } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatNumber } from "@/lib/utils";

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

  const recipeSelectorRef = useRef<HTMLDivElement>(null);



  // Handle clicking outside to close recipe selector (desktop only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isMobile && recipeSelectorRef.current && !recipeSelectorRef.current.contains(event.target as Node)) {
        closeRecipeSelector();
      }
    };

    if (showRecipeSelector && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRecipeSelector, isMobile]);

  // Get all available recipes for this meal type
  const { data: availableRecipes } = useQuery<Recipe[]>({
    queryKey: ['/api/recipes'],
  });

  const mealTypeRecipes = availableRecipes?.filter(r => 
    r.mealTypes?.includes(mealType) && 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const closeRecipeSelector = () => {
    setShowRecipeSelector(false);
    setSearchTerm("");
  };

  // Calculate total calories for all recipes in this meal
  const totalCalories = recipes.reduce((sum, recipe) => sum + recipe.calories, 0);

  // Mutation to add recipe to meal
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
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/macros'] });
      closeRecipeSelector();
      toast({
        title: "Recipe Added",
        description: "Successfully added recipe to your meal.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add recipe to meal.",
        variant: "destructive",
      });
    },
  });

  // Mutation to remove specific recipe from meal
  const removeRecipeMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      return apiRequest('DELETE', `/api/meal-plans/${weekStartDate}/${dayOfWeek}/${mealType}/${recipeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/macros'] });
      toast({
        title: "Recipe Removed",
        description: "Successfully removed recipe from meal.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove recipe from meal.",
        variant: "destructive",
      });
    },
  });

  // Mutation to move recipe between meal slots
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/macros'] });
      toast({
        title: "Recipe Moved",
        description: "Successfully moved recipe to new meal slot.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to move recipe.",
        variant: "destructive",
      });
    },
  });

  const handleAddRecipe = (recipeId: number) => {
    addRecipeMutation.mutate(recipeId);
  };

  const handleRemoveRecipe = (recipeId: number) => {
    removeRecipeMutation.mutate(recipeId);
  };

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
    // Only set to false if leaving the card entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
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
      
      // Don't move if dropped on the same slot
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

  // Desktop recipe list (a render function, not a component, so the input keeps focus)
  const renderDesktopRecipeList = () => (
    <>
      <div className="text-sm font-medium mb-3">Choose a recipe for {mealType}:</div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search recipes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-7 h-7 text-xs"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          data-testid="input-recipe-search-desktop"
        />
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {mealTypeRecipes.length > 0 ? (
          mealTypeRecipes.map((recipe) => (
            <button
              key={recipe.id}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors text-sm"
              onClick={() => handleAddRecipe(recipe.id)}
              data-testid={`button-select-recipe-${recipe.id}`}
            >
              <div className="font-medium">{recipe.name}</div>
              <div className="text-gray-500 text-sm">
                {formatNumber(recipe.calories)} calories • {recipe.protein}g protein
              </div>
            </button>
          ))
        ) : (
          <div className="text-gray-400 px-3 py-2 text-center">
            No recipes found for "{searchTerm}"
          </div>
        )}
      </div>
      <button
        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md text-gray-500 border-t mt-3 pt-3 transition-colors text-sm"
        onClick={closeRecipeSelector}
        data-testid="button-cancel-recipe-selection"
      >
        Cancel
      </button>
    </>
  );

  // Mobile bottom sheet for choosing a recipe (portalled: the card's hover transform would trap a fixed overlay)
  const renderMobileSelector = () => createPortal(
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeRecipeSelector();
      }}
    >
      <div className="w-full bg-white rounded-t-xl max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add Recipe to {mealType}</h3>
            <button 
              onClick={closeRecipeSelector}
              className="p-2 hover:bg-gray-100 rounded-full"
              data-testid="button-close-selector"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-sm font-medium mb-3">Choose a recipe for {mealType}:</div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 text-base"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-testid="input-recipe-search"
            />
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto mb-20">
            {mealTypeRecipes.length > 0 ? (
              mealTypeRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors text-base"
                  onClick={() => handleAddRecipe(recipe.id)}
                  data-testid={`button-select-recipe-${recipe.id}`}
                >
                  <div className="font-medium">{recipe.name}</div>
                  <div className="text-gray-500 text-sm">
                    {formatNumber(recipe.calories)} calories • {recipe.protein}g protein
                  </div>
                </button>
              ))
            ) : (
              <div className="text-gray-400 px-3 py-2 text-center">
                No recipes found for "{searchTerm}"
              </div>
            )}
          </div>
        </div>
        {/* Sticky Cancel Button */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <button
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors text-base font-medium"
            onClick={closeRecipeSelector}
            data-testid="button-cancel-recipe-selection"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  if (recipes.length === 0) {
    return (
      <Card 
        className={`meal-card-empty group cursor-pointer hover:bg-gray-50 transition-colors border-2 border-dashed rounded-lg p-3 h-auto min-h-[120px] flex items-center justify-center relative ${
          isDraggedOver ? 'border-green-400 bg-green-50' : 'border-gray-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div 
          className="text-center w-full h-full flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowRecipeSelector(true);
          }}
        >
          <div>
            <div className="text-gray-400 text-xl mb-2 mx-auto h-6 w-6 flex items-center justify-center border border-dashed border-gray-300 rounded">+</div>
            <div className="text-xs text-gray-500 break-words">Add Recipe</div>
          </div>
        </div>
        
        {/* Recipe Selector - Mobile vs Desktop */}
        {isMobile && showRecipeSelector && renderMobileSelector()}
        
        {!isMobile && showRecipeSelector && (
          <div 
            ref={recipeSelectorRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
          >
            <div className="p-3">
              {renderDesktopRecipeList()}
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card 
      className={`meal-card group hover:shadow-md transition-all duration-200 bg-white rounded-lg p-3 h-auto min-h-[120px] relative flex flex-col ${
        isDraggedOver ? 'border-2 border-green-400 bg-green-50' : 'border border-gray-200'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {/* Total calories at the top */}
      <div className="text-xs text-gray-600 mb-2 font-medium">
        {formatNumber(totalCalories)} cal total
      </div>
      
      {/* Recipe list - flexible height */}
      <div className="space-y-2 mb-3 flex-1">
        {recipes.map((recipe) => (
          <div 
            key={recipe.id} 
            className="relative bg-gray-50 rounded-lg p-2.5 border border-gray-100 hover:border-gray-200 transition-all group/recipe cursor-move"
            draggable
            onDragStart={(e) => handleDragStart(e, recipe)}
          >
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-white border border-gray-200 rounded-full shadow-sm text-gray-400 hover:text-red-500 hover:border-red-200 sm:opacity-0 sm:group-hover/recipe:opacity-100 transition-all z-10"
              onClick={() => handleRemoveRecipe(recipe.id)}
              title="Remove recipe"
            >
              <X className="h-3 w-3" />
            </Button>
            <div className="pr-2">
              <div className="font-medium text-gray-900 text-sm leading-tight mb-1">
                {recipe.name}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {formatNumber(recipe.calories)} calories
                </span>
                <span className="text-gray-500">
                  {recipe.protein}g protein
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add more button - always at bottom */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 hover:border-gray-400 mt-auto"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowRecipeSelector(true);
        }}
      >
        <span className="text-lg mr-1">+</span>
        Add Recipe
      </Button>

      {/* Recipe Selector - Mobile vs Desktop */}
      {isMobile && showRecipeSelector && renderMobileSelector()}
      
      {!isMobile && showRecipeSelector && (
        <div 
          ref={recipeSelectorRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          <div className="p-3">
            {renderDesktopRecipeList()}
          </div>
        </div>
      )}
    </Card>
  );
}
