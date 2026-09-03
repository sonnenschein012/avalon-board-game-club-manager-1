import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '../index.css';
import ScenarioLabApp from './ScenarioLabApp';

if (import.meta.env.MODE !== 'scenario') {
  throw new Error('Scenario Lab is local-only. Start it with "npm run scenario-lab".');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ScenarioLabApp />
    </HashRouter>
  </StrictMode>,
);
