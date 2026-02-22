import { createRoot } from 'react-dom/client';
import { Providers } from './providers.ts';
import { App } from './App.tsx';
import '../styles.css';

createRoot(document.getElementById('root')!).render(
    <Providers>
        <App />
    </Providers>
);
