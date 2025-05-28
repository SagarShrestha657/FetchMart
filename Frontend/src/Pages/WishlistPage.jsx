import React from 'react';
import { Link } from 'react-router-dom';
import useStore from './States/store';

const WishlistPage = () => {
  const { wishlist, removeFromWishlist, clearWishlist } = useStore();

  return (
    <div className="min-h-screen backdrop-blur-sm rounded-2xl  shadow-lg bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-500 drop-shadow-xl mb-10 animate-fade-in">
          My Wishlist
        </h1>

        {wishlist.length === 0 ? (
          <div className="text-center mt-12 animate-fade-in">
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">Your wishlist is empty</p>
            <Link
              to="/"
              className="inline-block bg-gradient-to-r from-blue-500 to-pink-500 text-white font-semibold px-6 py-3 rounded-full shadow-md hover:scale-105 hover:shadow-lg transition-all duration-300"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-6">
              <button
                onClick={clearWishlist}
                className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 transition-colors shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {wishlist.map((product) => (
                <div
                  key={`${product.platform}-${product.name}`}
                  className="relative flex flex-col h-full bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-700"
                >
                  {/* Platform Tag and Remove Button Container */}
                  <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-3">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full z-10 ${
                      {
                        Amazon: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
                        Flipkart: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
                        Meesho: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300",
                        Myntra: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
                        Ajio: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
                      }[product.platform] || "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}>
                      {product.platform}
                    </span>

                    <button
                      onClick={() => removeFromWishlist(product)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Product Image with enhanced styling */}
                  {product.image && (
                    <div className="w-full flex justify-center items-center mb-3 min-h-[160px] group">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-36 sm:h-40 object-contain rounded-xl shadow group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Product Info with enhanced styling */}
                  <div className="flex flex-col flex-1 justify-between text-center mb-2">
                    <h2 className="font-semibold text-lg sm:text-xl text-gray-800 dark:text-gray-200 leading-tight line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{product.name}</h2>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">{product.brand}</span>

                    {/* Rating and Reviews with enhanced styling */}
                    {typeof product.reviewRating === "number" && (
                      <div className="flex justify-center gap-0.5 mt-2">
                        {[1, 2, 3, 4, 5].map(i => {
                          const fillPercent = Math.max(0, Math.min(1, product.reviewRating - (i - 1)));
                          if (fillPercent === 1) {
                            return <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" /></svg>;
                          } else if (fillPercent === 0) {
                            return <svg key={i} className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" /></svg>;
                          } else {
                            const gradId = `grad-${product.id}-${i}`;
                            return (
                              <svg key={i} className="w-4 h-4" viewBox="0 0 20 20">
                                <defs>
                                  <linearGradient id={gradId}>
                                    <stop offset={`${fillPercent * 100}%`} stopColor="#facc15" />
                                    <stop offset={`${fillPercent * 100}%`} stopColor="#d1d5db" />
                                  </linearGradient>
                                </defs>
                                <path
                                  fill={`url(#${gradId})`}
                                  d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z"
                                />
                              </svg>
                            );
                          }
                        })}
                      </div>
                    )}
                    {product.reviews && (
                      <span className="text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900 rounded px-2 py-0.5 mt-1 mx-auto w-fit">
                        {product.reviews}
                      </span>
                    )}
                  </div>

                  {/* Price with enhanced styling */}
                  <div className="flex justify-center items-center gap-2 mt-2">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">₹{product.price?.toLocaleString()}</p>
                    {product.discount && (
                      <span className="text-sm text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900 px-2 py-0.5 rounded font-semibold">[{product.discount}]</span>
                    )}
                  </div>

                  {/* Buy Button with enhanced styling */}
                  <Link
                    to={product.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 bg-gradient-to-r from-blue-500 to-pink-500 text-white py-2 rounded-full font-medium text-sm hover:scale-105 hover:shadow-lg transition-all duration-300 text-center"
                  >
                    Buy Now
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WishlistPage; 