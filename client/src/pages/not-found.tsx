import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="max-w-md">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Page not found</p>
        <h1 className="mt-2 font-display text-4xl text-foreground">This page isn't on the menu</h1>
        <p className="mt-3 text-muted-foreground">The link may be old or mistyped. Your meal plan is safe.</p>
        <Button asChild className="mt-6">
          <Link href="/">Back to the planner</Link>
        </Button>
      </div>
    </main>
  );
}
