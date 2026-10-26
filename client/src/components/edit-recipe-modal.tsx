import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MealType, Recipe } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const recipeSchema = z.object({
  name: z.string().min(1, "Recipe name is required"),
  description: z.string().min(1, "Description is required"),
  mealTypes: z.array(z.enum(["breakfast", "lunch", "snack", "dinner"])).min(1, "At least one meal type is required"),
  calories: z.number().min(1, "Calories must be greater than 0"),
  protein: z.number().min(0, "Protein cannot be negative"),
  carbs: z.number().min(0, "Carbs cannot be negative"),
  fats: z.number().min(0, "Fats cannot be negative"),
  maxWeeklyUses: z.number().min(1, "Must allow at least 1 use per week"),
});

type RecipeFormData = z.infer<typeof recipeSchema>;

interface EditRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
}

export function EditRecipeModal({ isOpen, onClose, recipe }: EditRecipeModalProps) {
  const [isGeneratingMacros, setIsGeneratingMacros] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      maxWeeklyUses: 3,
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      mealTypes: [],
    },
  });

  const recipeName = watch("name");
  const mealTypes = watch("mealTypes");
  
  // Reset form when recipe changes
  useEffect(() => {
    if (recipe) {
      reset({
        name: recipe.name,
        description: recipe.description || "",
        mealTypes: (recipe.mealTypes || []) as MealType[],
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fats: recipe.fats,
        maxWeeklyUses: recipe.maxWeeklyUses,
      });
    }
  }, [recipe, reset]);
  
  const handleMealTypeChange = (mealType: MealType, checked: boolean) => {
    const currentMealTypes = mealTypes || [];
    if (checked) {
      setValue("mealTypes", [...currentMealTypes, mealType]);
    } else {
      setValue("mealTypes", currentMealTypes.filter(type => type !== mealType));
    }
  };

  // Generate macros using AI
  const generateMacrosMutation = useMutation({
    mutationFn: async () => {
      if (!recipeName || !mealTypes?.length) {
        throw new Error("Recipe name and at least one meal type are required");
      }

      const response = await apiRequest('POST', '/api/ai/generate-recipe', {
        mealType: mealTypes[0], // Use first meal type for AI analysis
        recipeName,
        targetMacros: {},
        restrictions: [],
      });
      return await response.json();
    },
    onSuccess: (data) => {
      // Update form values with AI generated data
      setValue("calories", data.calories);
      setValue("protein", data.protein);
      setValue("carbs", data.carbs);
      setValue("fats", data.fats);
      
      toast({
        title: "Macros Generated",
        description: "AI has estimated the nutritional information for your recipe.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate macros. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update recipe mutation
  const updateRecipeMutation = useMutation({
    mutationFn: async (data: RecipeFormData) => {
      if (!recipe) throw new Error("No recipe to update");
      
      const response = await apiRequest('PUT', `/api/recipes/${recipe.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      // Macros on the planner depend on recipe values
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/macros'] });
      toast({
        title: "Success",
        description: "Recipe updated successfully!",
      });
      reset();
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update recipe. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateMacros = async () => {
    if (!recipeName || !mealTypes?.length) {
      toast({
        title: "Missing Information",
        description: "Please enter a recipe name and select at least one meal type first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingMacros(true);
    try {
      await generateMacrosMutation.mutateAsync();
    } finally {
      setIsGeneratingMacros(false);
    }
  };

  const onSubmit = (data: RecipeFormData) => {
    updateRecipeMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!recipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle>Edit Recipe</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            <div>
              <Label htmlFor="name">Recipe Name</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g., Grilled Chicken Salad"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Brief description of the recipe"
                className={errors.description ? "border-red-500" : ""}
                rows={2}
              />
              {errors.description && (
                <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
              )}
            </div>

            <div>
              <Label>Meal Types</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {["breakfast", "lunch", "snack", "dinner"].map((mealType) => (
                  <div key={mealType} className="flex items-center space-x-2">
                    <Checkbox
                      id={mealType}
                      checked={mealTypes?.includes(mealType as MealType) || false}
                      onCheckedChange={(checked) => 
                        handleMealTypeChange(mealType as MealType, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={mealType} 
                      className="text-sm font-normal capitalize cursor-pointer"
                    >
                      {mealType}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.mealTypes && (
                <p className="text-sm text-red-500 mt-1">{errors.mealTypes.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="maxWeeklyUses">Max Weekly Uses</Label>
              <Input
                id="maxWeeklyUses"
                type="number"
                {...register("maxWeeklyUses", { valueAsNumber: true })}
                min="1"
                max="7"
                className={errors.maxWeeklyUses ? "border-red-500" : ""}
              />
              {errors.maxWeeklyUses && (
                <p className="text-sm text-red-500 mt-1">{errors.maxWeeklyUses.message}</p>
              )}
            </div>
          </div>

          {/* AI Macro Generation */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-green-800">AI Macro Generation</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateMacros}
                  disabled={isGeneratingMacros || !recipeName || !mealTypes?.length}
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  {isGeneratingMacros ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {isGeneratingMacros ? "Generating..." : "Generate Macros"}
                </Button>
              </div>
              <p className="text-sm text-green-700">
                Let AI estimate the nutritional information based on your recipe name and meal type.
              </p>
            </CardContent>
          </Card>

          {/* Nutritional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Nutritional Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="calories">Calories</Label>
                <Input
                  id="calories"
                  type="number"
                  {...register("calories", { valueAsNumber: true })}
                  min="0"
                  className={errors.calories ? "border-red-500" : ""}
                />
                {errors.calories && (
                  <p className="text-sm text-red-500 mt-1">{errors.calories.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="protein">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  step="0.1"
                  {...register("protein", { valueAsNumber: true })}
                  min="0"
                  className={errors.protein ? "border-red-500" : ""}
                />
                {errors.protein && (
                  <p className="text-sm text-red-500 mt-1">{errors.protein.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  step="0.1"
                  {...register("carbs", { valueAsNumber: true })}
                  min="0"
                  className={errors.carbs ? "border-red-500" : ""}
                />
                {errors.carbs && (
                  <p className="text-sm text-red-500 mt-1">{errors.carbs.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="fats">Fats (g)</Label>
                <Input
                  id="fats"
                  type="number"
                  step="0.1"
                  {...register("fats", { valueAsNumber: true })}
                  min="0"
                  className={errors.fats ? "border-red-500" : ""}
                />
                {errors.fats && (
                  <p className="text-sm text-red-500 mt-1">{errors.fats.message}</p>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Sticky Form Actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
              <Button type="button" variant="outline" onClick={handleClose} className="order-2 sm:order-1" data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateRecipeMutation.isPending}
                className="bg-primary text-white hover:bg-green-600 order-1 sm:order-2"
                data-testid="button-update-recipe"
              >
                {updateRecipeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {updateRecipeMutation.isPending ? "Updating..." : "Update Recipe"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}