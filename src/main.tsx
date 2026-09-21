import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store/store';
import { ModalProvider } from './context/ModalContext';
import { AlertProvider } from './context/AlertContext';
import { LoadingProvider } from './context/LoadingContext';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AlertProvider>
          <LoadingProvider>
            <ModalProvider>
              <App />
              {/* Toast surfaces read the live theme variables, so they follow light/dark. */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    boxShadow: '0 14px 34px -14px var(--shadow-lg-color)',
                    fontSize: '13px',
                    fontWeight: 500,
                    maxWidth: '22rem',
                  },
                  success: {
                    iconTheme: { primary: 'var(--success)', secondary: 'var(--surface)' },
                  },
                  error: {
                    iconTheme: { primary: 'var(--danger)', secondary: 'var(--surface)' },
                  },
                }}
              />
            </ModalProvider>
          </LoadingProvider>
        </AlertProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
