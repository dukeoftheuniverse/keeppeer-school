import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import SchoolProfile from '@/pages/SchoolProfile';
import AccountSettings from '@/pages/AccountSettings';
import UserAccounts from '@/pages/UserAccounts';
import Employees from '@/pages/Employees';
import Students from '@/pages/Students';
import StudentProfile from '@/pages/StudentProfile';
import EmployeeProfile from '@/pages/EmployeeProfile';
import GradeSection from '@/pages/GradeSection';
import ClassDetail from '@/pages/ClassDetail';
import IDMaker from '@/pages/IDMaker';
import AttendanceScanner from '@/pages/AttendanceScanner';
import Reports from '@/pages/Reports';
import DownloadSource from '@/pages/DownloadSource';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/school-profile" element={<SchoolProfile />} />
          <Route path="/account-settings" element={<AccountSettings />} />
          <Route path="/user-accounts" element={<UserAccounts />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/students" element={<Students />} />
          <Route path="/student/:id" element={<StudentProfile />} />
          <Route path="/employee/:id" element={<EmployeeProfile />} />
          <Route path="/classes" element={<GradeSection />} />
          <Route path="/class/:id" element={<ClassDetail />} />
          <Route path="/id-maker" element={<IDMaker />} />
          <Route path="/attendance" element={<AttendanceScanner />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/download-source" element={<DownloadSource />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App