import { useState, useCallback } from 'react';
import { Dashboard } from './pages/Dashboard';
import { LoadingScreen } from './components/LoadingScreen';
import { Toaster } from 'sonner';

function App() {
  const [ready, setReady] = useState(false);
  const handleLoadComplete = useCallback(() => setReady(true), []);

  return (
    <>
      {!ready && <LoadingScreen onComplete={handleLoadComplete} />}
      {ready && <Dashboard />}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(21,27,39,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#D8DCE6',
            backdropFilter: 'blur(12px)',
          },
        }}
      />
    </>
  );
}

export default App;
