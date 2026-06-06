import { Dashboard } from './pages/Dashboard'
import { Toaster } from 'sonner'
import './App.css'

function App() {
  return (
    <>
      <Toaster theme="dark" position="bottom-right" />
      <Dashboard />
    </>
  )
}

export default App
