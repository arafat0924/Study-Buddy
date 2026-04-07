import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function Landing() {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden pt-36">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl relative z-10 mt-24"
      >
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
          Welcome to TrustMeBruh
        </h1>
        <p className="text-xl text-blue-200 mb-12">
          Your trustworthy bruh for fair and random shuffles. Choose your tool below.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/course-group" className="px-8 py-4 bg-gradient-to-r from-blue-400 to-indigo-300 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/25">
            Presentation Group Shuffle
          </Link>
          <Link to="/fifa" className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-red-500/25">
            Fifa Tournament Shuffle
          </Link>
        </div>
      </motion.div>

      <footer className="mt-auto py-8 w-full text-center text-blue-200">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-sm">
            ©️ Md. Arafat Hosen (赞欣)
          </p>
        </div>
      </footer>
    </div>
  );
}
