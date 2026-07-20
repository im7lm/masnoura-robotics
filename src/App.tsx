import { Layout } from './components/Layout';
import { RouterProvider, useRouter } from './components/Router';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SessionsPage, SessionDetailsPage } from './pages/SessionsPage';
import { TasksPage, TaskDetailsPage } from './pages/TasksPage';
import { QuizzesPage } from './pages/QuizzesPage';
import { AttendancePage } from './pages/AttendancePage';
import { EvaluationPage } from './pages/EvaluationPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { MembersPage } from './pages/MembersPage';
import { MemberProfilePage } from './pages/MemberProfilePage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { TeamManagementPage } from './pages/TeamManagementPage';

function Routes() {
  const { path } = useRouter();

  let page: React.ReactNode;
  if (path === '/' || path === '/dashboard') page = <DashboardPage />;
  else if (path === '/sessions') page = <SessionsPage />;
  else if (path.startsWith('/sessions/')) page = <SessionDetailsPage id={path.split('/')[2]} />;
  else if (path === '/tasks') page = <TasksPage />;
  else if (path.startsWith('/tasks/')) page = <TaskDetailsPage id={path.split('/')[2]} />;
  else if (path === '/quizzes') page = <QuizzesPage />;
  else if (path === '/attendance') page = <AttendancePage />;
  else if (path === '/evaluation') page = <EvaluationPage />;
  else if (path === '/leaderboard') page = <LeaderboardPage />;
  else if (path === '/members') page = <MembersPage />;
  else if (path.startsWith('/members/')) page = <MemberProfilePage id={path.split('/')[2]} />;
  else if (path === '/announcements') page = <AnnouncementsPage />;
  else if (path === '/team') page = <TeamManagementPage />;
  else page = <DashboardPage />;

  return <Layout>{page}</Layout>;
}

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <LoginPage />;
  return <Routes />;
}

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
