import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Utensils, Sparkles, BookOpen, User, LogOut } from "lucide-react";
import { WeeklyOverview } from "@/components/weekly-overview";
import { MealCalendar } from "@/components/meal-calendar";
import { DailyMacroSummary } from "@/components/daily-macro-summary";
import { AIRecommendationModal } from "@/components/ai-recommendation-modal";
import { formatNumber } from "@/lib/utils";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { addDays, formatShortDate, getDisplayDays, parseDateKey, todayKey } from "@/lib/dates";
import type { WeeklyMacros, WeeklyMealPlan, WeeklyTargets } from "@shared/schema";

// Format display for 4-day period
function formatPeriodDisplay(startDate: string): string {
  const end = addDays(startDate, 3);
  return `${formatShortDate(startDate)} - ${formatShortDate(end)}, ${parseDateKey(startDate).getFullYear()}`;
}

export default function MealPlanner() {
  const [viewStartDate, setViewStartDate] = useState(todayKey());
  const [showAIModal, setShowAIModal] = useState(false);
  const { toast } = useToast();

  // The 4 visible days can span two Monday-based weeks; fetch both
  const displayDays = getDisplayDays(viewStartDate);
  const weekStartForAPI = displayDays[0].weekStart;
  const nextWeekStart = displayDays[displayDays.length - 1].weekStart;

  const { data: mealPlan, isLoading: mealPlanLoading } = useQuery<WeeklyMealPlan>({
    queryKey: ['/api/meal-plans', weekStartForAPI],
  });
  const { data: nextMealPlan, isLoading: nextMealPlanLoading } = useQuery<WeeklyMealPlan>({
    queryKey: ['/api/meal-plans', nextWeekStart],
  });

  const { data: weeklyMacros, isLoading: macrosLoading } = useQuery<WeeklyMacros>({
    queryKey: ['/api/macros', weekStartForAPI],
  });
  const { data: nextWeeklyMacros, isLoading: nextMacrosLoading } = useQuery<WeeklyMacros>({
    queryKey: ['/api/macros', nextWeekStart],
  });

  const mealPlansByWeek: Record<string, WeeklyMealPlan | undefined> = {
    [weekStartForAPI]: mealPlan,
    [nextWeekStart]: nextMealPlan,
  };
  const macrosByWeek: Record<string, WeeklyMacros | undefined> = {
    [weekStartForAPI]: weeklyMacros,
    [nextWeekStart]: nextWeeklyMacros,
  };

  // Fetch targets
  const { data: targets, isLoading: targetsLoading } = useQuery<WeeklyTargets>({
    queryKey: ['/api/targets'],
  });

  // Fetch current session info
  const { data: sessionInfo } = useQuery({
    queryKey: ['/api/auth/session'],
  });

  const navigateWeek = (direction: 'prev' | 'next') => {
    const offset = direction === 'next' ? 4 : -4; // Move by 4 days
    setViewStartDate(addDays(viewStartDate, offset));
  };

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout');
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      window.location.replace('/login');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <Utensils className="text-primary text-xl sm:text-2xl" />
                <h1 className="text-lg sm:text-xl font-display font-semibold text-foreground hidden xs:block">AI Meal Planner</h1>
                <h1 className="text-lg font-display font-semibold text-foreground xs:hidden">Meal Plan</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/recipes">
                <Button variant="secondary" size="sm" className="hidden sm:flex">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Recipe Library
                </Button>
                <Button variant="secondary" size="sm" className="sm:hidden p-2">
                  <BookOpen className="h-4 w-4" />
                </Button>
              </Link>
              <Button 
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 hidden sm:flex"
                onClick={() => setShowAIModal(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Plan
              </Button>
              <Button 
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 sm:hidden p-2"
                onClick={() => setShowAIModal(true)}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {(sessionInfo as any)?.family?.name || 'Loading...'}
                </span>
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="text-primary-foreground h-4 w-4" />
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-foreground hidden sm:flex"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-foreground sm:hidden p-2"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Week Navigation */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <h2 className="text-xl sm:text-2xl font-display font-semibold text-foreground">
                {formatPeriodDisplay(viewStartDate)}
              </h2>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                  className="p-2 hover:bg-muted rounded-lg"
                >
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                  className="p-2 hover:bg-muted rounded-lg"
                >
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
            {targets && (
              <Card className="shadow-sm border">
                <CardContent className="p-3">
                  <div className="text-sm text-muted-foreground">Weekly Target</div>
                  <div className="text-lg font-semibold text-foreground">
                    {formatNumber(targets.dailyCalories * 7)} cal
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Weekly Overview */}
          {targets && weeklyMacros && (
            <WeeklyOverview 
              weeklyMacros={weeklyMacros} 
              targets={targets} 
              isLoading={macrosLoading || targetsLoading} 
            />
          )}
        </div>

        {/* Meal Planning Calendar */}
        <MealCalendar 
          displayDays={displayDays}
          mealPlansByWeek={mealPlansByWeek}
          isLoading={mealPlanLoading || nextMealPlanLoading}
        />

        {/* Daily Macro Summary */}
        {targets && (
          <DailyMacroSummary 
            macrosByWeek={macrosByWeek}
            targets={targets}
            displayDays={displayDays}
            isLoading={macrosLoading || nextMacrosLoading}
          />
        )}
      </div>

      {/* AI Recommendation Modal */}
      <AIRecommendationModal 
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        weekStartDate={weekStartForAPI}
      />
    </div>
  );
}
