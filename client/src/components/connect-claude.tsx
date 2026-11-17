import { useEffect, useState } from "react";
import { Check, Copy, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// The remote MCP server lives at /mcp on whatever host serves the app
const mcpUrl = () => `${window.location.origin}/mcp`;

const EXAMPLES = [
  "Plan high-protein breakfasts for next week",
  "How much protein is planned for today?",
  "Add a recipe for masala oats with a YouTube video",
];

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: select the text so it can be copied by hand
      (document.getElementById("mcp-url") as HTMLInputElement | null)?.select();
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        id="mcp-url"
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="font-mono text-sm"
        aria-label="Connector address"
      />
      <Button type="button" variant="outline" onClick={copy} className="shrink-0" data-testid="button-copy-mcp-url">
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function ConnectClaudeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-connect-claude">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-display font-normal text-2xl">Plan meals by chatting with Claude</DialogTitle>
          <DialogDescription>
            Add MealMaster to Claude once, then ask in any chat to plan your week, add recipes or check your macros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="mcp-url" className="text-sm font-medium text-foreground">
              Connector address
            </label>
            <CopyField value={mcpUrl()} />
          </div>

          <ol className="space-y-3 text-sm leading-relaxed text-foreground">
            {[
              <>In Claude (claude.ai or the Claude app), open <strong>Settings → Connectors</strong>.</>,
              <>Choose <strong>Add custom connector</strong>, name it <strong>MealMaster</strong> and paste the address above.</>,
              <>Select <strong>Connect</strong>. A MealMaster page opens: enter your family password and choose <strong>Allow</strong>.</>,
              <>In a chat, make sure MealMaster is switched on in the tools menu, then just ask.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground tabular"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-secondary/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try asking</p>
            <ul className="mt-1.5 space-y-1 text-sm text-foreground">
              {EXAMPLES.map((e) => (
                <li key={e}>“{e}”</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Claude only sees this kitchen's plan and the shared recipe library. Other apps that support MCP connectors use
            the same address.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const HINT_KEY = "mealmaster:connect-claude-hint-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

// One-time nudge on the planner; dismissing it (or opening the steps) hides it for good on this device
export function ConnectClaudeHint({ onOpen }: { onOpen: () => void }) {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => setDismissed(readDismissed()), []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Storage unavailable: hide for this visit only
    }
  };

  if (dismissed) return null;

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3 sm:items-center"
      role="note"
      data-testid="hint-connect-claude"
    >
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:mt-0" aria-hidden />
      <p className="flex-1 text-sm text-foreground">
        <span className="font-medium">Plan by chatting with Claude.</span>{" "}
        <span className="text-muted-foreground">Connect MealMaster once and ask Claude to fill your week.</span>
      </p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 bg-background"
        onClick={() => {
          dismiss();
          onOpen();
        }}
      >
        Show me how
      </Button>
      <button
        type="button"
        onClick={dismiss}
        className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
