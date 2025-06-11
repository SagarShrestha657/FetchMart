import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useStore from '../States/store';

const NavbarComponent = () => {
  const location = useLocation();
  const { wishlist, isDarkMode, toggleDarkMode } = useStore();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-gray-900 backdrop-blur-md shadow-md border-b border-gray-300 dark:border-gray-800">
      <div className="w-full mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            className="flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <img src="/logo.svg" alt="FetchMart Logo" className="h-10" />
          </Link>
          
          <div className="flex gap-4 items-center">
            {/* <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md transition-colors text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-yellow-300 dark:hover:text-yellow-200 dark:hover:bg-gray-800"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </button> */}

            <Link
              to="/"
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('/')
                ? 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-gray-800 scale-105'
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-300 dark:hover:bg-gray-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </Link>
            
            <Link
              to="/about"
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('/about')
                ? 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-gray-800 scale-105'
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-300 dark:hover:bg-gray-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About
            </Link>
            
            <Link
              to="/wishlist"
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('/wishlist')
                ? 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-gray-800 scale-105'
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-300 dark:hover:bg-gray-800'
              }`}
            >
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {wishlist.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 dark:bg-red-400 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {wishlist.length}
                  </span>
                )}
              </div>
              Wishlist
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavbarComponent;
