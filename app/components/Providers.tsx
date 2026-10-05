'use client';

import { AuthProvider } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import { ToastProvider } from '../context/ToastContext';
import AuthGuard from './AuthGuard';
import SpanishValidation from './SpanishValidation';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SpanishValidation />
      <AuthProvider>
        <DataProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
