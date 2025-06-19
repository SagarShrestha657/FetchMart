import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const ComparePage = () => {
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const hasRequested = useRef(false);

  const BACKEND_URL =
    import.meta.env.MODE === "development"
      ? "http://localhost:5001/api"
      : import.meta.env.VITE_BACKEND_URL;


  useEffect(() => {
    const fetchComparisonData = async () => {
      // Prevent double execution
      if (hasRequested.current) return;
      hasRequested.current = true;

      try {
        if (!location.state?.products) {
          toast.error('No products selected for comparison');
          navigate('/wishlist');
          return;
        }

        // Send only platform and link to backend
        const simplifiedProducts = location.state.products.map(product => ({
          platform: product.platform,
          link: product.link
        }));

        const response = await axios.post(`${BACKEND_URL}/compare/compare`, {
          products: simplifiedProducts
        });
        // Create merged data structure with numeric indices
        const mergedData = {
          image: { 1: '', 2: '' },
          name: { 1: '', 2: '' },
          price: { 1: '', 2: '' },
          rating: { 1: '', 2: '' },
          reviews: { 1: '', 2: '' }
        };

        // Add existing product details from navigation state
        location.state.products.forEach((product, index) => {
          const platformIndex = index + 1;
          mergedData.image[platformIndex] = product.image;
          mergedData.name[platformIndex] = product.name;
          mergedData.price[platformIndex] = product.price;
          mergedData.rating[platformIndex] = product.reviewRating;
          mergedData.reviews[platformIndex] = product.reviews ? (() => {
            const match = product.reviews.match(/\((.*?)\)/);
            return match ? match[1] : '-';
          })() : '-';
        });

        // Add scraped data from backend
        if (response.data.products) {
          Object.entries(response.data.products).forEach(([feature, values]) => {
            mergedData[feature] = values; // Already in correct format { 1: value1, 2: value2 }
          });
        }
        setComparisonData(mergedData);
      } catch (error) {
        console.error('Error fetching comparison data:', error);
        toast.error(error?.response?.data?.error || "Something went wrong!");
      } finally {
        setLoading(false);
      }
    };

    fetchComparisonData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading comparison data...</p>
        </div>
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 text-lg mb-4">No comparison data available</p>
          <button
            onClick={() => navigate('/wishlist')}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Wishlist
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8 rounded-3xl shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Product Comparison
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Compare products side by side to make the best choice
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-center">
              <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="w-1/5 px-6 py-4 text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Specifications
                  </th>
                  <th className="w-2/5 px-6 py-4 text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Product 1
                  </th>
                  <th className="w-2/5 px-6 py-4 text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
                    Product 2
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {/* Image Row */}
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="w-1/5 px-6 py-6 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    Image
                  </td>
                  {Object.entries(comparisonData.image).map(([platform, image]) => (
                    <td key={platform} className="w-2/5 px-6 py-6">
                      {image && (
                        <div className="flex justify-center">
                          <img 
                            src={image} 
                            alt={comparisonData.name[platform]} 
                            className="h-32 sm:h-48 w-32 sm:w-48 object-contain rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300" 
                          />
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Product Name Row */}
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="w-1/5 px-6 py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    Product Name
                  </td>
                  {Object.entries(comparisonData.name).map(([platform, name]) => (
                    <td key={platform} className="w-2/5 px-6 py-4">
                      <h3 className="text-xs sm:text-lg font-semibold text-gray-900 dark:text-white">
                        {name || '-'}
                      </h3>
                    </td>
                  ))}
                </tr>

                {/* Price Row */}
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="w-1/5 px-6 py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    Price
                  </td>
                  {Object.entries(comparisonData.price).map(([platform, price]) => (
                    <td key={platform} className="w-2/5 px-6 py-4">
                      <div className="text-base sm:text-xl font-bold text-green-600 dark:text-green-400">
                        {price ? `₹${price.toLocaleString()}` : '-'}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Rating Row */}
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="w-1/5 px-6 py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    Rating
                  </td>
                  {Object.entries(comparisonData.rating).map(([platform, rating]) => (
                    <td key={platform} className="w-2/5 px-6 py-4">
                      {rating ? (
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-xl sm:text-2xl text-yellow-400">★</span>
                          <span className="text-sm sm:text-lg font-semibold">{rating}</span>
                        </div>
                      ) : '-'}
                    </td>
                  ))}
                </tr>

                {/* Reviews Row */}
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="w-1/5 px-6 py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    Reviews
                  </td>
                  {Object.entries(comparisonData.reviews).map(([platform, reviews]) => (
                    <td key={platform} className="w-2/5 px-6 py-4">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {reviews || '-'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Product Details Rows */}
                {Object.entries(comparisonData).map(([feature, values]) => {
                  if (['image', 'name', 'rating', 'reviews', 'price'].includes(feature)) {
                    return null;
                  }

                  if (typeof values === 'object' && values !== null) {
                    return (
                      <tr key={feature} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="w-1/5 px-6 py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {feature.replace(/([A-Z])/g, ' $1').trim()}
                        </td>
                        <td className="w-2/5 px-6 py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {values[1] || '-'}
                        </td>
                        <td className="w-2/5 px-6 py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {values[2] || '-'}
                        </td>
                      </tr>
                    );
                  }
                  return null;
                })}

                {/* Buy Now Row */}
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="w-1/5 px-6 py-6 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                    Buy Now
                  </td>
                  {Object.entries(comparisonData.name).map(([platform, name], index) => (
                    <td key={platform} className="w-2/5 px-6 py-6">
                      {location.state?.products[index]?.link ? (
                        <a
                          href={location.state.products[index].link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-4 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-900 dark:border-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] dark:shadow-[0_4px_14px_0_rgba(255,255,255,0.1)] dark:hover:shadow-[0_6px_20px_rgba(255,255,255,0.2)]"
                        >
                          Buy Now
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate('/wishlist')}
            className="px-4 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-900 dark:border-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] dark:shadow-[0_4px_14px_0_rgba(255,255,255,0.1)] dark:hover:shadow-[0_6px_20px_rgba(255,255,255,0.2)]"
          >
            Back to Wishlist
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-900 dark:border-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] dark:shadow-[0_4px_14px_0_rgba(255,255,255,0.1)] dark:hover:shadow-[0_6px_20px_rgba(255,255,255,0.2)]"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComparePage; 