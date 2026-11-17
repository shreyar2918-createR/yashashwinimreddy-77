import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Database,
  RefreshCw,
  Server,
  X,
} from "lucide-react";
import { executeFirestoreConnectionTest, type FirestoreTestResult } from "@/services/firestoreTest";
import { cn } from "@/lib/utils";

export function FirestoreConnectionWidget() {
  const [result, setResult] = useState<FirestoreTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [copied, setCopied] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      const res = await executeFirestoreConnectionTest();
      setResult(res);
    } catch (err) {
      console.error("[VINORA] Failed to run test:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only run write/read test when the diagnostic tool is opened by the user
    if (!dismissed && !result) {
      runTest();
    }
  }, [dismissed, result]);

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => {
          setDismissed(false);
          setExpanded(true);
          if (!result) runTest();
        }}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur transition hover:bg-muted"
        title="Open Firestore Connection Status"
      >
        <span
          className={cn(
            "size-2 rounded-full",
            result?.state === "success"
              ? "bg-emerald-500"
              : result?.state === "error"
                ? "bg-amber-500"
                : "bg-muted-foreground",
          )}
        />
        <Database className="size-3.5 text-muted-foreground" />
        <span>Firestore Test</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Cloud Firestore Connection Diagnostics"
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm overflow-hidden border border-border bg-background/95 shadow-xl backdrop-blur-md sm:max-w-md"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-2.5 rounded-full",
              loading
                ? "animate-pulse bg-sky-500"
                : result?.state === "success"
                  ? "bg-emerald-500"
                  : result?.state === "error"
                    ? "bg-amber-500"
                    : "bg-muted-foreground",
            )}
          />
          <div className="flex items-center gap-1.5">
            <Database className="size-4 text-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Firestore Connection Test
            </span>
          </div>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            test_collection
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={runTest}
            disabled={loading}
            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Re-run write & read test"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Minimize to floating pill"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-h-[75vh] overflow-y-auto p-4 text-xs">
          {/* Target details */}
          <div className="mb-3 grid grid-cols-2 gap-2 rounded border border-border/70 bg-muted/20 p-2 font-mono text-[11px]">
            <div>
              <span className="text-muted-foreground">Project: </span>
              <span className="font-semibold text-foreground">vinora-fe3a3</span>
            </div>
            <div>
              <span className="text-muted-foreground">Database: </span>
              <span className="font-semibold text-foreground">(default)</span>
            </div>
            <div>
              <span className="text-muted-foreground">Collection: </span>
              <span className="text-foreground">test_collection</span>
            </div>
            <div>
              <span className="text-muted-foreground">Document: </span>
              <span className="text-foreground">connection_status</span>
            </div>
          </div>

          {/* Operation Status Badges */}
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between rounded border border-border/60 px-2.5 py-1.5">
              <span className="font-medium text-foreground">1. Write Operation</span>
              {loading ? (
                <span className="font-mono text-sky-600 dark:text-sky-400">writing...</span>
              ) : result?.writeSuccess ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Success
                </span>
              ) : result ? (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3.5" /> Blocked
                </span>
              ) : (
                <span className="text-muted-foreground">Idle</span>
              )}
            </div>

            <div className="flex items-center justify-between rounded border border-border/60 px-2.5 py-1.5">
              <span className="font-medium text-foreground">2. Read Operation (Server)</span>
              {loading ? (
                <span className="font-mono text-sky-600 dark:text-sky-400">reading...</span>
              ) : result?.readSuccess ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Success ({result.durationMs}ms)
                </span>
              ) : result ? (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3.5" /> Blocked
                </span>
              ) : (
                <span className="text-muted-foreground">Idle</span>
              )}
            </div>
          </div>

          {/* SUCCESS VIEW: Retrieved data from Firestore */}
          {result?.state === "success" && result.retrievedData && (
            <div className="space-y-2.5">
              <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-4" />
                  <span className="font-semibold text-sm">
                    Firestore Database Connection Fully Active
                  </span>
                </div>
                <p className="mt-1 text-emerald-800/90 dark:text-emerald-200/90">
                  Document written and successfully read back directly from Cloud Firestore!
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-foreground">Live Read Operation Result:</span>
                  <span className="text-[10px] text-muted-foreground">
                    Updated {result.timestamp}
                  </span>
                </div>
                <pre className="overflow-x-auto rounded border border-border bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-foreground">
                  {JSON.stringify(result.retrievedData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* ERROR / ACTION REQUIRED VIEW */}
          {result?.state === "error" && (
            <div className="space-y-3">
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="size-4" />
                  <span className="font-semibold">Action Required: Cloud Firestore Rules</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {result.errorMessage}
                </p>
              </div>

              {result.errorCode?.includes("permission-denied") && (
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">
                    Allow access to <code className="font-mono text-primary">test_collection</code>{" "}
                    in Firebase Console:
                  </p>
                  <div className="relative">
                    <pre className="overflow-x-auto rounded border border-border bg-muted/60 p-2.5 font-mono text-[11px] text-foreground">
                      {`// In Firebase Console > Firestore Database > Rules:
match /test_collection/{docId} {
  allow get: if docId == 'connection_status';
  allow create, update: if docId == 'connection_status' &&
    incoming().keys().hasAll(['status', 'clientTimestamp', 'message']) &&
    incoming().status is string &&
    incoming().message is string && incoming().message.size() <= 200 &&
    incoming().clientTimestamp is string;
  allow delete: if isAdmin();
}`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `match /test_collection/{docId} {\n  allow get: if docId == 'connection_status';\n  allow create, update: if docId == 'connection_status' &&\n    incoming().keys().hasAll(['status', 'clientTimestamp', 'message']) &&\n    incoming().status is string &&\n    incoming().message is string && incoming().message.size() <= 200 &&\n    incoming().clientTimestamp is string;\n  allow delete: if isAdmin();\n}`,
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted"
                    >
                      {copied ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    After adding this snippet and clicking <strong>Publish</strong> in the Firebase
                    Console, click the button below to re-verify.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer controls */}
          <div className="mt-3.5 flex items-center justify-between border-t border-border pt-2.5">
            <span className="text-[10px] text-muted-foreground">
              CLI script: <code className="font-mono">npm run test:firestore</code>
            </span>
            <button
              type="button"
              onClick={runTest}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              <span>{loading ? "Testing..." : "Test Connection Again"}</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
