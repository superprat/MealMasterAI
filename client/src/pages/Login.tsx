import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { MEAL_TYPES } from "@/lib/meals";
import { cn } from "@/lib/utils";

export default function Login() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        // Give the session a moment to save, then reload so it's picked up
        setTimeout(() => {
          window.location.replace("/");
        }, 300);
        return;
      }
      setError("That password doesn't match any family. Check it and try again.");
    } catch {
      setError("Couldn't reach MealMaster. Check your connection and try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-secondary/70 border-r border-border p-12 xl:p-16">
        <div className="font-display text-2xl">
          Meal<span className="text-primary">Master</span>
        </div>
        <div>
          <p className="font-display text-5xl xl:text-6xl leading-[1.05] text-foreground max-w-lg">
            What's for dinner this week?
          </p>
          <ul className="mt-10 space-y-3 max-w-xs">
            {MEAL_TYPES.map((meal) => (
              <li key={meal.type} className="flex items-center gap-3 border-b border-dashed border-foreground/15 pb-3">
                <span className={cn("h-2.5 w-2.5 rounded-full", meal.dot)} aria-hidden />
                <span className="text-sm font-medium text-foreground/80">{meal.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">One planner and one recipe box for the whole family.</p>
      </div>

      {/* Sign-in form */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden font-display text-2xl mb-10">
            Meal<span className="text-primary">Master</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground">Sign in</h1>
          <p className="mt-2 text-muted-foreground">Enter your family password to open your plan.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="password">Family password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  disabled={isLoading}
                  aria-invalid={!!error}
                  aria-describedby={error ? "password-error" : undefined}
                  className={cn("h-11 pr-11 bg-card", error && "border-destructive focus-visible:ring-destructive")}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <p id="password-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full h-11 text-base" disabled={isLoading || !password} data-testid="button-sign-in">
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
