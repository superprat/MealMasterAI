import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Planner" },
  { href: "/recipes", label: "Recipes" },
];

export function AppHeader() {
  const [location] = useLocation();
  const { toast } = useToast();
  const { data: sessionInfo } = useQuery<{ family?: { name: string } }>({
    queryKey: ["/api/auth/session"],
  });
  const familyName = sessionInfo?.family?.name;

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      window.location.replace("/login");
    } catch {
      toast({
        title: "Couldn't sign out",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center gap-4 sm:gap-8">
        <Link href="/" className="font-display text-xl sm:text-2xl leading-none text-foreground shrink-0">
          Meal<span className="text-primary">Master</span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          {familyName && (
            <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[12rem]" data-testid="text-family-name">
              {familyName}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            aria-label="Sign out"
            className="text-muted-foreground hover:text-foreground px-2 sm:px-3"
            data-testid="button-logout"
          >
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
