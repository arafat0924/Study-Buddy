import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
      <nav className="bg-[#11235a]/80 backdrop-blur-lg rounded-2xl border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] hover:border-blue-500/40 transition-all duration-300 pointer-events-auto overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-400/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 scanline" />
        <div className="px-6 h-12 flex items-center gap-8 relative z-10">
          <Link to="/" className="font-bold text-lg tracking-tight text-white hover:text-blue-300 transition-colors">
            TrustMeBruh
          </Link>
          <div className="flex gap-6 items-center">
            <Link
              to="/course-group"
              className={`text-xs font-medium transition-all duration-300 px-3 py-1 rounded-lg ${location.pathname === '/course-group'
                ? 'text-white bg-blue-600/20 shadow-[0_0_10px_rgba(37,99,235,0.2)]'
                : 'text-blue-200 hover:text-white hover:bg-white/5'
                }`}
            >
              Presentation Group Shuffle
            </Link>
            <Link
              to="/fifa"
              className={`text-xs font-medium transition-all duration-300 px-3 py-1 rounded-lg ${location.pathname === '/fifa'
                ? 'text-white bg-blue-600/20 shadow-[0_0_10px_rgba(37,99,235,0.2)]'
                : 'text-blue-200 hover:text-white hover:bg-white/5'
                }`}
            >
              Fifa Tournament Shuffle
            </Link>
            <button className="text-[10px] uppercase tracking-widest font-bold text-blue-400/40 cursor-not-allowed select-none" disabled>
              More Coming...
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
