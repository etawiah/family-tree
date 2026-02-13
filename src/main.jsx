import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Redirect to canonical domain (login gate) — disabled until domain is on Worker.
// const APP_URL = import.meta.env.VITE_APP_URL || 'https://family-tree.tawiah.net'
// let shouldRedirect = false
// if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
//   try {
//     const appHost = new URL(APP_URL).hostname
//     if (window.location.hostname !== appHost) {
//       window.location.replace(APP_URL + window.location.pathname + window.location.search)
//       shouldRedirect = true
//     }
//   } catch (_) {}
// }
// if (!shouldRedirect) {
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
// }
