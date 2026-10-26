import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, ArrowLeft, Download, Upload } from "lucide-react";
import { Recipe, MealType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/utils";
import { todayKey } from "@/lib/dates";
import { Link } from "wouter";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { EditRecipeModal } from "@/components/edit-recipe-modal";

export default function RecipeLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMealType, setSelectedMealType] = useState<MealType | "all">("all");
  const [sortBy, setSortBy] = useState<"name" | "newest" | "oldest">("name");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all recipes
  const { data: recipes, isLoading } = useQuery<Recipe[]>({
    queryKey: ['/api/recipes'],
  });

  // Fetch current session info
  const { data: sessionInfo } = useQuery({
    queryKey: ['/api/auth/session'],
  });

  // Delete recipe mutation
  const deleteRecipeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/recipes/${id}`);
    },
    onSuccess: () => {
      // Deleting a recipe also removes it from every meal plan
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/macros'] });
      toast({
        title: "Recipe Deleted",
        description: "Recipe has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete recipe.",
        variant: "destructive",
      });
    },
  });

  // Export recipes mutation
  const exportRecipesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/recipes/export');
      if (!response.ok) {
        throw new Error('Failed to export recipes');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Create and download the file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recipes-export-${todayKey()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: `Successfully exported ${data.recipes.length} recipes.`,
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export recipes.",
        variant: "destructive",
      });
    },
  });

  // Import recipes mutation
  const importRecipesMutation = useMutation({
    mutationFn: async (recipes: any[]) => {
      const response = await apiRequest('POST', '/api/recipes/import', { recipes });
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.imported} recipes. ${result.errors > 0 ? `${result.errors} errors occurred.` : ''}`,
      });
    },
    onError: () => {
      toast({
        title: "Import Failed",
        description: "Failed to import recipes.",
        variant: "destructive",
      });
    },
  });

  // Handle file import
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.recipes && Array.isArray(data.recipes)) {
          importRecipesMutation.mutate(data.recipes);
        } else {
          toast({
            title: "Invalid File",
            description: "The selected file does not contain valid recipe data.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Invalid File",
          description: "Failed to parse the selected file.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };

  const filteredRecipes = recipes?.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recipe.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMealType = selectedMealType === "all" || recipe.mealTypes?.includes(selectedMealType);
    return matchesSearch && matchesMealType;
  }).sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "name":
      default:
        return a.name.localeCompare(b.name);
    }
  }) || [];

  const mealTypeColors = {
    breakfast: "bg-amber-50 text-amber-700 border border-amber-200",
    lunch: "bg-emerald-50 text-emerald-700 border border-emerald-200", 
    snack: "bg-violet-50 text-violet-700 border border-violet-200",
    dinner: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  };

  const RecipeCard = ({ recipe }: { recipe: Recipe }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold mb-2">{recipe.name}</CardTitle>
            <p className="text-sm text-gray-600 mb-2">{recipe.description}</p>
            <div className="flex flex-wrap gap-1">
              {recipe.mealTypes?.map((mealType, index) => (
                <Badge key={index} className={`${mealTypeColors[mealType as MealType]} text-xs`}>
                  {mealType}
                </Badge>
              )) || <Badge className="bg-gray-100 text-gray-800 text-xs">No meal type</Badge>}
            </div>
          </div>
          <div className="flex space-x-1 ml-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 w-9 p-0 sm:h-8 sm:w-8"
              onClick={() => {
                setEditingRecipe(recipe);
                setShowEditModal(true);
              }}
              data-testid={`button-edit-recipe-${recipe.id}`}
            >
              <Edit className="h-4 w-4 text-gray-500" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 w-9 p-0 sm:h-8 sm:w-8 text-red-500 hover:text-red-700"
              onClick={() => {
                if (window.confirm(`Delete "${recipe.name}"? It will also be removed from every meal plan.`)) {
                  deleteRecipeMutation.mutate(recipe.id);
                }
              }}
              data-testid={`button-delete-recipe-${recipe.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">{formatNumber(recipe.calories)} cal</div>
            <div className="text-xs text-gray-600">Calories</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">{recipe.protein}g</div>
            <div className="text-xs text-gray-600">Protein</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">{recipe.carbs}g</div>
            <div className="text-xs text-gray-600">Carbs</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">{recipe.fats}g</div>
            <div className="text-xs text-gray-600">Fats</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Max weekly uses: {recipe.maxWeeklyUses}</span>
            {recipe.isAiSuggested && <span>AI Suggested</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-5 w-16" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[...Array(4)].map((_, j) => (
                      <div key={j}>
                        <Skeleton className="h-4 w-12 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="p-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-xl font-display font-semibold text-foreground">Recipe Library</h1>
              <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                {filteredRecipes.length}
              </Badge>
            </div>
            <div className="flex space-x-1 sm:space-x-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => exportRecipesMutation.mutate()}
                disabled={exportRecipesMutation.isPending || !recipes?.length}
                className="hidden sm:flex hover:bg-accent hover:text-accent-foreground"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => exportRecipesMutation.mutate()}
                disabled={exportRecipesMutation.isPending || !recipes?.length}
                className="sm:hidden p-2"
              >
                <Download className="h-4 w-4" />
              </Button>
              
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                  disabled={importRecipesMutation.isPending}
                />
                <Button 
                  variant="outline"
                  size="sm"
                  disabled={importRecipesMutation.isPending}
                  className="hidden sm:flex"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importRecipesMutation.isPending ? 'Importing...' : 'Import'}
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  disabled={importRecipesMutation.isPending}
                  className="sm:hidden p-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              
              <Button 
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 hidden sm:flex"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Recipe
              </Button>
              <Button 
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 sm:hidden p-2"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
                <Select value={sortBy} onValueChange={(value: "name" | "newest" | "oldest") => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedMealType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMealType("all")}
            >
              All
            </Button>
            <Button
              variant={selectedMealType === "breakfast" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMealType("breakfast")}
            >
              Breakfast
            </Button>
            <Button
              variant={selectedMealType === "lunch" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMealType("lunch")}
            >
              Lunch
            </Button>
            <Button
              variant={selectedMealType === "snack" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMealType("snack")}
            >
              Snack
            </Button>
            <Button
              variant={selectedMealType === "dinner" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMealType("dinner")}
            >
              Dinner
            </Button>
          </div>
        </div>

        {/* Recipe Grid */}
        {filteredRecipes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedMealType !== "all" 
                ? "No recipes match your search criteria" 
                : "No recipes found"}
            </p>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Recipe
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>

      <AddRecipeModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
      <EditRecipeModal 
        isOpen={showEditModal} 
        onClose={() => {
          setShowEditModal(false);
          setEditingRecipe(null);
        }} 
        recipe={editingRecipe}
      />
    </div>
  );
}