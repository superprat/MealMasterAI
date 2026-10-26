import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MealType } from "@shared/schema";
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

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRecipeModal({ isOpen, onClose }: AddRecipeModalProps) {
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
    setError,
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
    onSuccess: (recipe: any) => {
      setValue("calories", recipe.calories || 0);
      setValue("protein", recipe.protein || 0);
      setValue("carbs", recipe.carbs || 0);
      setValue("fats", recipe.fats || 0);
      if (recipe.description && !watch("description")) {
        setValue("description", recipe.description);
      }
      toast({
        title: "Nutrition estimated",
        description: "Check the numbers before saving.",
      });
    },
    onError: () => {
      toast({
        title: "Couldn't estimate nutrition",
        description: "Enter the numbers yourself, or try again.",
        variant: "destructive",
      });
    },
  });

  // Create recipe
  const createRecipeMutation = useMutation({
    mutationFn: async (data: RecipeFormData) => {
      return apiRequest('POST', '/api/recipes', {
        ...data,
        isAiSuggested: false,
        isApproved: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      toast({
        title: "Recipe added",
        description: "It's ready to use in the planner.",
      });
      reset();
      onClose();
    },
    onError: (error: Error) => {
      if (error.message.startsWith("409:")) {
        setError("name", { message: "There's already a recipe with this name in the library." });
        return;
      }
      toast({
        title: "Couldn't save the recipe",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateMacros = async () => {
    if (!recipeName || !mealTypes?.length) {
      toast({
        title: "Add a name and meal type first",
        description: "The estimate is based on them.",
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
    createRecipeMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="font-display font-normal text-2xl">New recipe</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
            <h3 className="font-display text-lg">The recipe</h3>
            
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g. Grilled chicken salad"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="A line to jog your memory"
                className={errors.description ? "border-destructive" : ""}
                rows={2}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
              )}
            </div>

            <div>
              <Label>Meals</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
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
                <p className="text-sm text-destructive mt-1">{errors.mealTypes.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="maxWeeklyUses">Most times per week</Label>
              <Input
                id="maxWeeklyUses"
                type="number"
                {...register("maxWeeklyUses", { valueAsNumber: true })}
                min="1"
                max="7"
                className={errors.maxWeeklyUses ? "border-destructive" : ""}
              />
              {errors.maxWeeklyUses && (
                <p className="text-sm text-destructive mt-1">{errors.maxWeeklyUses.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Meal suggestions won’t use it more often than this.</p>
            </div>
          </div>

          {/* Estimate nutrition */}
          <Card className="bg-secondary/60 border-border shadow-none">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 space-y-2 sm:space-y-0">
                <h3 className="text-base font-semibold text-foreground">Estimate nutrition</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateMacros}
                  disabled={isGeneratingMacros || !recipeName || !mealTypes?.length}
                  className="w-full sm:w-auto bg-background"
                >
                  {isGeneratingMacros ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {isGeneratingMacros ? "Estimating…" : "Estimate with AI"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Fills in calories and macros from the recipe name. Check the numbers before saving.
              </p>
            </CardContent>
          </Card>

          {/* Nutritional Information */}
          <div className="space-y-4">
            <h3 className="font-display text-lg">Nutrition</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="calories">Calories</Label>
                <Input
                  id="calories"
                  type="number"
                  {...register("calories", { valueAsNumber: true })}
                  min="0"
                  className={errors.calories ? "border-destructive" : ""}
                />
                {errors.calories && (
                  <p className="text-sm text-destructive mt-1">{errors.calories.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="protein">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  {...register("protein", { valueAsNumber: true })}
                  min="0"
                  step="0.1"
                  className={errors.protein ? "border-destructive" : ""}
                />
                {errors.protein && (
                  <p className="text-sm text-destructive mt-1">{errors.protein.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  {...register("carbs", { valueAsNumber: true })}
                  min="0"
                  step="0.1"
                  className={errors.carbs ? "border-destructive" : ""}
                />
                {errors.carbs && (
                  <p className="text-sm text-destructive mt-1">{errors.carbs.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="fats">Fat (g)</Label>
                <Input
                  id="fats"
                  type="number"
                  {...register("fats", { valueAsNumber: true })}
                  min="0"
                  step="0.1"
                  className={errors.fats ? "border-destructive" : ""}
                />
                {errors.fats && (
                  <p className="text-sm text-destructive mt-1">{errors.fats.message}</p>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Sticky Form Actions */}
          <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 sm:px-6 sm:py-4">
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
              <Button type="button" variant="outline" onClick={handleClose} className="order-2 sm:order-1" data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRecipeMutation.isPending}
                className="order-1 sm:order-2"
                data-testid="button-add-recipe"
              >
                {createRecipeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {createRecipeMutation.isPending ? "Saving…" : "Save recipe"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}