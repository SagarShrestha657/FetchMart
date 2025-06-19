import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { FiMessageSquare, FiHeart } from 'react-icons/fi';
import HomePage from './Pages/HomePage';
import WishlistPage from './Pages/WishlistPage';
import NavbarComponent from './Components/NavbarComponent';
import DarkModeToggle from './Components/DarkModeToggle'
import useStore from "./States/store"
import './App.css';
import AboutPage from './Pages/AboutPage';
import Chat from './Pages/Chat';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import ComparePage from './Pages/ComparePage';

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
            <Route path="/chat" element={<Chat />} />
            <Route path="/compare" element={<ComparePage />} />
            {/* Add more routes here as needed */}
          </Routes>
        </main>
        <DarkModeToggle />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'custom-toast',
            duration: 3000,
            style: {
              background: isDarkMode ? '#1f2937' : '#ffffff',
              color: isDarkMode ? '#f3f4f6' : '#1f2937',
              border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
              boxShadow: isDarkMode 
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            },
            success: {
              duration: 3000,
              style: {
                background: isDarkMode ? '#064e3b' : '#ecfdf5',
                color: isDarkMode ? '#d1fae5' : '#065f46',
                border: isDarkMode ? '1px solid #047857' : '1px solid #10b981',
              },
            },
            error: {
              duration: 4000,
              style: {
                background: isDarkMode ? '#7f1d1d' : '#fef2f2',
                color: isDarkMode ? '#fecaca' : '#991b1b',
                border: isDarkMode ? '1px solid #b91c1c' : '1px solid #ef4444',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
