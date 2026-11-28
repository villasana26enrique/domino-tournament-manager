import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TournamentService } from '../application/tournament-service.js';
import { createRuntimeRepository } from '../infrastructure/runtime-repository.js';
import { registerPwaServiceWorker } from '../infrastructure/pwa-register.js';
import { App } from './App.js';
import './styles/index.css';

void registerPwaServiceWorker();

const { repository, runtimeLabel } = createRuntimeRepository();
const service = new TournamentService({ repository });

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('No se encontró el contenedor #root en index.html.');
}

createRoot(rootEl).render(
  <StrictMode>
    <App service={service} runtimeLabel={runtimeLabel} />
  </StrictMode>
);
