import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Send visitors to the canonical domain so they hit the Worker and see the login gate
const APP_URL = import.meta.env.VITE_APP_URL || 'https://family-tree.tawiah.net'
let shouldRedirect = false
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  try {
    const appHost = new URL(APP_URL).hostname
    if (window.location.hostname !== appHost) {
      window.location.replace(APP_URL + window.location.pathname + window.location.search)
      shouldRedirect = true
    }
  } catch (_) {}
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/53e3d4a7-e895-4c1a-a9aa-dfd44319e82e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.jsx:redirect-check',message:'Page origin and redirect',data:{hostname:window.location.hostname,appHost:new URL(APP_URL).hostname,shouldRedirect,title:document.title,bodyHasSignIn:document.body?.innerHTML?.includes('Sign in')||false,bodyHasRoot:document.body?.innerHTML?.includes('id="root"')||false},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
}

if (!shouldRedirect) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/53e3d4a7-e895-4c1a-a9aa-dfd44319e82e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.jsx:app-render',message:'SPA rendering',data:{hostname:typeof window!=='undefined'?window.location.hostname:'ssr',shouldRedirect},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
