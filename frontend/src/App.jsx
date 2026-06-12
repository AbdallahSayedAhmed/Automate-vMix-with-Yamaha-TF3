import { lazy, Suspense, useState, useCallback } from "react";
import { LoadingScreen } from "./components/LoadingScreen";
import { Toaster } from "sonner";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);

function App() {
  const [ready, setReady] = useState(false);
  const handleLoadComplete = useCallback(() => setReady(true), []);

  return (
    <>
      {!ready && <LoadingScreen onComplete={handleLoadComplete} />}
      {ready && (
        <Suspense
          fallback={
            <div className="dashboard-shell flex items-center justify-center p-4">
              <div className="glass-panel rounded-2xl px-5 py-4 text-sm font-semibold text-live-cyan">
                Loading dashboard…
              </div>
            </div>
          }
        >
          <Dashboard />
        </Suspense>
      )}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgba(21,27,39,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#D8DCE6",
            backdropFilter: "blur(12px)",
          },
        }}
      />
    </>
  );
}

export default App;
