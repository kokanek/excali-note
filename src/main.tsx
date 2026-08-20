import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { Landing } from './components/Landing.tsx';
import './index.css';

// No router in this app: App swaps dashboard/editor with local state. The
// landing page is a single static route, so a plain pathname check keeps it
// out of the bundle's critical path and adds no dependency. A hard load of
// /landing on Vercel is handled by the rewrite in vercel.json.
const isLanding = window.location.pathname.replace(/\/+$/, '') === '/landing';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isLanding ? <Landing /> : <App />}</StrictMode>
);
