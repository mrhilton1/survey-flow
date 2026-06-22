/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from './AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './Dashboard';
import { SurveyEditor } from './SurveyEditor';
import { SurveyView } from './SurveyView';
import { ReportView } from './ReportView';

// Placeholder components

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background text-foreground">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/editor/:id?" element={<SurveyEditor />} />
              <Route path="/s/:id" element={<SurveyView />} />
              <Route path="/r/:id" element={<ReportView />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
