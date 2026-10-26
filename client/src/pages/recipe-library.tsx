import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Download, Upload } from "lucide-react";
import { Recipe, MealType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn, formatNumber } from "@/lib/utils";
import { MEAL_TYPES } from "@/lib/meals";
import { AppHeader } from "@/components/app-header";
import { todayKey } from "@/lib/dates";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { EditRecipeModal } from "@/components/edit-recipe-modal";

export default function RecipeLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMealType, setSelectedMealType] = useState<MealType | "all">("all");
  const [sortBy, setSortBy] = useState<"name" | "newest" | "oldest">("name");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all recipes
  const { data: recipes, isLoading } = useQuery<Recipe[]>({
    queryKey: ['/api/recipes'],
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
      setDeletingRecipe(null);
      toast({ title: "Recipe deleted" });
    },
    onError: () => {
      toast({
        title: "Couldn't delete the recipe",
        description: "Check your connection and try again.",
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
        title: `Exported ${data.recipes.length} recipes`,
        description: "Saved as a JSON file in your downloads.",
      });
    },
    onError: () => {
      toast({
        title: "Couldn't export recipes",
        description: "Check your connection and try again.",
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
        title: `Imported ${result.imported} recipes`,
        description: result.errors > 0 ? `${result.errors} couldn't be read and were skipped.` : undefined,
      });
    },
    onError: () => {
      toast({
        title: "Couldn't import recipes",
        description: "Check your connection and try again.",
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
            title: "That file has no recipes in it",
            description: "Choose a JSON file exported from MealMaster.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Couldn't read that file",
          description: "Choose a JSON file exported from MealMaster.",
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

  const hasFilters = searchTerm !== "" || selectedMealType !== "all";

  const RecipeRow = ({ recipe }: { recipe: Recipe }) => (
    <li className="group grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1fr)_9rem_repeat(4,4.5rem)_5rem] items-center gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-accent/50 transition-colors">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-foreground">{recipe.name}</span>
          {recipe.isAiSuggested && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">From suggestions</span>
          )}
        </div>
        {recipe.description && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{recipe.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 md:order-none order-last col-span-2 md:col-span-1 flex-wrap">
        {recipe.mealTypes?.length ? (
          MEAL_TYPES.filter((m) => recipe.mealTypes.includes(m.type)).map((m) => (
            <span
              key={m.type}
              className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-foreground/80", m.soft)}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
              {m.label}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No meal type</span>
        )}
      </div>

      <dl className="contents tabular text-sm">
        {[
          { label: "Calories", value: formatNumber(recipe.calories), unit: "" },
          { label: "Protein", value: recipe.protein, unit: "g" },
          { label: "Carbs", value: recipe.carbs, unit: "g" },
          { label: "Fat", value: recipe.fats, unit: "g" },
        ].map((m) => (
          <div key={m.label} className="hidden md:block text-right">
            <dt className="sr-only">{m.label}</dt>
            <dd className="text-foreground">
              {m.value}
              <span className="text-muted-foreground">{m.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex justify-end gap-0.5 row-start-1 col-start-2 md:row-auto md:col-auto">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setEditingRecipe(recipe);
            setShowEditModal(true);
          }}
          aria-label={`Edit ${recipe.name}`}
          data-testid={`button-edit-recipe-${recipe.id}`}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => setDeletingRecipe(recipe)}
          aria-label={`Delete ${recipe.name}`}
          data-testid={`button-delete-recipe-${recipe.id}`}
        >
          <Trash2 />
        </Button>
      </div>

      <p className="md:hidden col-span-2 text-xs text-muted-foreground tabular -mt-1">
        {formatNumber(recipe.calories)} cal · {recipe.protein}g protein · {recipe.carbs}g carbs · {recipe.fats}g fat
      </p>
    </li>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-foreground leading-tight">Recipe library</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? "Loading recipes…" : `${recipes?.length ?? 0} recipes, shared by every family`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
              disabled={importRecipesMutation.isPending}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={importRecipesMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-import"
            >
              <Upload />
              {importRecipesMutation.isPending ? "Importing…" : "Import"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportRecipesMutation.mutate()}
              disabled={exportRecipesMutation.isPending || !recipes?.length}
              data-testid="button-export"
            >
              <Download />
              Export
            </Button>
            <Button onClick={() => setShowAddModal(true)} className="ml-auto sm:ml-1" data-testid="button-open-add-recipe">
              <Plus />
              Add recipe
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search by name or description"
              aria-label="Search recipes"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by meal">
            {[{ type: "all" as const, label: "All", dot: "" }, ...MEAL_TYPES].map((m) => {
              const active = selectedMealType === m.type;
              return (
                <button
                  key={m.type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedMealType(m.type)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  {m.dot && <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden />}
                  {m.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <span className="text-sm text-muted-foreground">Sort</span>
            <Select value={sortBy} onValueChange={(value: "name" | "newest" | "oldest") => setSortBy(value)}>
              <SelectTrigger className="w-32 h-9 bg-card" aria-label="Sort recipes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">A to Z</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card divide-y divide-border" aria-busy="true">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-4 py-4 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
            {hasFilters ? (
              <>
                <p className="font-display text-xl text-foreground">Nothing matches that</p>
                <p className="mt-1 text-sm text-muted-foreground">Try another word or meal type.</p>
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedMealType("all");
                  }}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="font-display text-xl text-foreground">Your recipe box is empty</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Add the dishes your family eats most, or import a file exported from MealMaster.
                </p>
                <Button className="mt-5" onClick={() => setShowAddModal(true)}>
                  <Plus />
                  Add your first recipe
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_9rem_repeat(4,4.5rem)_5rem] gap-x-4 px-4 py-2.5 border-b border-border bg-muted/50 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Recipe</span>
              <span>Meals</span>
              <span className="text-right">Cal</span>
              <span className="text-right">Protein</span>
              <span className="text-right">Carbs</span>
              <span className="text-right">Fat</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y divide-border">
              {filteredRecipes.map((recipe) => (
                <RecipeRow key={recipe.id} recipe={recipe} />
              ))}
            </ul>
          </div>
        )}
      </main>

      <AlertDialog open={!!deletingRecipe} onOpenChange={(open) => !open && setDeletingRecipe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-normal text-2xl">Delete {deletingRecipe?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the library and from every family's meal plans. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingRecipe && deleteRecipeMutation.mutate(deletingRecipe.id)}
              data-testid="button-confirm-delete"
            >
              Delete recipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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