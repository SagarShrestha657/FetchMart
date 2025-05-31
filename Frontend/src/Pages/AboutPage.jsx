import React from 'react';

function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6 backdrop-blur-sm rounded-2xl  shadow-lg">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-500 drop-shadow-xl mb-4">
            About FetchMart
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Your Smart Shopping Companion
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Our Mission</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            At FetchMart, we're dedicated to making online shopping smarter and more efficient. 
            Our platform helps you find the best deals across multiple e-commerce platforms, 
            ensuring you never overpay for your favorite products.
          </p>

          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-2">Price Comparison</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Compare prices across multiple platforms including Amazon, Flipkart, Meesho, 
                Myntra, and Ajio to find the best deals.
              </p>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/30 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-pink-700 dark:text-pink-400 mb-2">Smart Search</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Our intelligent search system helps you find exactly what you're looking for 
                with advanced filtering and sorting options.
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-400 mb-2">Wishlist Feature</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Save your favorite products and track their prices over time to make informed 
                purchasing decisions.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl">
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">Real-time Updates</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get the most up-to-date prices and availability information from all major 
                e-commerce platforms.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">How It Works</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Search for Products</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Enter the name of the product you're looking for in our search bar.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Compare Prices</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  View prices from different platforms side by side to find the best deal.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Make Your Purchase</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Click through to your preferred platform to complete your purchase.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Contact Us</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Have questions or suggestions? We'd love to hear from you!
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:support@fetchmart.com"
              className="flex items-center justify-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Us
            </a>
            <a
              href="https://instagram.com/fetchmart"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-pink-500 text-white px-6 py-3 rounded-full hover:bg-pink-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Follow Us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutPage; 