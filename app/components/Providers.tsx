'use client';

import { AuthProvider } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import AuthGuard from './AuthGuard';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>
        <AuthGuard>
          {children}
        </AuthGuard>
      </DataProvider>
    </AuthProvider>
  );
}
