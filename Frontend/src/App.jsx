import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './Pages/HomePage';
import WishlistPage from './Pages/WishlistPage';
import NavbarComponent from './Components/NavbarComponent'
import DarkModeToggle from './Components/DarkModeToggle';
import useStore from './states/store';
import './App.css';
import AboutPage from './Pages/AboutPage';
import { useEffect } from 'react';

function App() {
  const { isDarkMode } = useStore();

  // Apply dark mode class on mount and when isDarkMode changes
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <Router>
      <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
        <NavbarComponent />
        <main className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/about" element={<AboutPage />} />
            {/* Add more routes here as needed */}
          </Routes>
        </main>
        <DarkModeToggle />
      </div>
    </Router>
  );
}

export default App;
