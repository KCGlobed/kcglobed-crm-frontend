import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.tsx'
import { store } from './app/store'
import { reloadForNewBuild } from './lib/staleBuild'

// a route's chunk from the previous build is gone after a deploy: reload into the new build instead of failing
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewBuild()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
