import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { CrmDashboard } from '../../src/components/CrmDashboard';

export default function CrmDashboardScreen() {
  const { user, loading } = useAuth();

  if (loading) return null;

  // Strict role check
  if (!user || user.role !== 'crm') {
    return <Redirect href="/" />;
  }

  return <CrmDashboard />;
}
