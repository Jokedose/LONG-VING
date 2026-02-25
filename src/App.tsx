import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import YearlyPlan from './pages/YearlyPlan';
import BodyMetrics from './pages/BodyMetrics';
import './App.css';

// Placeholder pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8"><h1 className="text-2xl font-bold">{title} (กำลังอยู่ระหว่างพัฒนา)</h1></div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          {/* <Route path="import" element={<Import />} /> */}
          <Route path="sessions" element={<Sessions />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="zones" element={<Placeholder title="วิเคราะห์ Zone 2" />} />
          <Route path="plan" element={<YearlyPlan />} />
          <Route path="body" element={<BodyMetrics />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
