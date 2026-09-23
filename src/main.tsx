import '@/app/styles/app.css';
import { createRoot } from 'react-dom/client';
import App from '@/app/App';
import { i18nReady } from '@/app/i18n/i18n';

void i18nReady.then(() => {
    createRoot(document.getElementById('root')!).render(<App />);
});
