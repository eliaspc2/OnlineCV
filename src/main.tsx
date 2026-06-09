import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './section-gradients.css';
import './mobile-hero.css';
import './scroll-notes.css';
import App from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
