import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ColorModeProvider } from '@/app/ColorModeContext';
import { queryClient } from '@/app/queryClient';
import { AuthProvider } from '@/auth/AuthContext';
import { ToastProvider } from '@/components/Toast';
import { NotificationProvider } from '@/notifications/NotificationProvider';
import { AppRoutes } from '@/routes/AppRoutes';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ColorModeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <NotificationProvider>
                <AppRoutes />
              </NotificationProvider>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ColorModeProvider>
  </StrictMode>
);
