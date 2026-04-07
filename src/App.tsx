import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import CourseGroupShuffle from './pages/PresentationGroupShuffle';
import FifaTournament from './pages/FifaTournament';
import ThreeBackground from './components/ThreeBackground';

function Layout() {
  const location = useLocation();
  const isCourseGroupPage = location.pathname === '/course-group';

  return (
    <div className="min-h-screen font-sans text-white selection:bg-blue-200 flex flex-col pt-0 bg-[#0a174e] relative isolate overflow-x-hidden">
      {!isCourseGroupPage && <ThreeBackground />}
      <Navbar />
      <div className="relative z-0 flex-1 flex flex-col pt-24">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/course-group" element={<CourseGroupShuffle />} />
          <Route path="/fifa" element={<FifaTournament />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}
