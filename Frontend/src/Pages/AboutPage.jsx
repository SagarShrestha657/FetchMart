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
              href="https://twitter.com/fetchmart"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-pink-500 text-white px-6 py-3 rounded-full hover:bg-pink-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
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