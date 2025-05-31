import { useState, useRef, useEffect } from "react";
import axios from "axios";
import InfiniteScroll from "react-infinite-scroll-component";
import NProgress from "nprogress"; // Import NProgress
import "../styles/nprogress.css";
import { Link } from "react-router-dom";
import useStore from '../States/store';

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  minimum: 0.1,
  easing: 'ease',
  speed: 500,
  trickleSpeed: 200,
});

function HomePage() {
  const {
    searchQuery,
    searchResults,
    searchFilters,
    searchSort,
    searchPage,
    hasMore,
    setSearchQuery,
    setSearchResults,
    setSearchFilters,
    setSearchSort,
    setSearchPage,
    setHasMore,
    appendSearchResults,
    recentSearches,
    addRecentSearch,
    clearRecentSearches
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const requestIdRef = useRef(0);
  const cancelSource = useRef(null);
  const recentSearchesRef = useRef(null);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (recentSearchesRef.current && !recentSearchesRef.current.contains(event.target)) {
        setShowRecentSearches(false);
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const BACKEND_URL =
    import.meta.env.MODE === "development"
      ? "http://localhost:5001/api"
      : import.meta.env.VITE_BACKEND_URL;

  // Get wishlist functions from store
  const wishlistStore = useStore();

  // Function to get suggestions
  const getSuggestions = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const { data } = await axios.get(`${BACKEND_URL}/suggestions`, {
        params: { query },
      });

      if (data.suggestions) {
        setSuggestions(data.suggestions.map(item => item.value));
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    }
  };

  // Handle input change with suggestions
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim()) {
      getSuggestions(value);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearch = (searchValue = null) => {
    const queryToSearch = searchValue || searchQuery;
    if (queryToSearch.trim().length < 1) return;

    // Check if we have a matching recent search
    const matchingSearch = recentSearches.find(search =>
      search.term === queryToSearch
    );

    if (matchingSearch) {
      // If we have a match, use the cached results and move to top
      setSearchResults(matchingSearch.results);
      setSearching(false);
      setSearchPage(matchingSearch.page);
      setHasMore(true);

      // Create new filters object with only matching platforms enabled
      const newFilters = Object.keys(searchFilters).reduce((acc, platform) => ({
        ...acc,
        [platform]: matchingSearch.platforms.includes(platform)
      }), {});
      setSearchFilters(newFilters);
      setShowRecentSearches(false);

      // Move the matching search to the top of recent searches
      addRecentSearch(queryToSearch, matchingSearch.results, matchingSearch.platforms, matchingSearch.page);
    } else {
      // If no match, perform new search
      setSearching(true);
      setSearchPage(1);
      setHasMore(true);
      setShowRecentSearches(false);
      fetchResults(true, 1, queryToSearch, true);
    }
  };

  const handleRecentSearchClick = async (query) => {
    // Check if we have a matching recent search
    const matchingSearch = recentSearches.find(search =>
      search.term === query //&& 

    );

    if (matchingSearch) {
      // If we have a match, use the cached results
      setSearchQuery(query);
      setSearchResults(matchingSearch.results);
      setSearching(false);
      setSearchPage(matchingSearch.page);
      setHasMore(true);

      // Create new filters object with only matching platforms enabled
      const newFilters = Object.keys(searchFilters).reduce((acc, platform) => ({
        ...acc,
        [platform]: matchingSearch.platforms.includes(platform)
      }), {});
      setSearchFilters(newFilters);
      setShowRecentSearches(false);

      // Move the matching search to the top
      await addRecentSearch(query, matchingSearch.results, matchingSearch.platforms, matchingSearch.page);
    } else {
      // If no match, perform new search
      setSearchQuery(query);
      setSearching(true);
      setSearchPage(1);
      setHasMore(true);
      setShowRecentSearches(false);
      fetchResults(true, 1, query, true);
    }
    setShowRecentSearches(false);
  };

  const fetchResults = async (reset = false, nextPage = 1, newQuery = null, isSearch = false) => {
    if (!(newQuery ?? searchQuery).trim()) return;

    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    if (isSearch) setSearching(true);
    NProgress.start();

    if (cancelSource.current) {
      cancelSource.current.abort();
    }
    cancelSource.current = new AbortController();

    try {
      const selectedPlatforms = Object.keys(searchFilters).filter((p) => searchFilters[p]);
      const { data } = await axios.post(
        `${BACKEND_URL}/search`,
        {
          query: newQuery ?? searchQuery,
          platforms: selectedPlatforms,
          page: nextPage,
          limit: 10,
        },
        { signal: cancelSource.current.signal }
      );

      if (reset) {
        setSearchResults(data);
        if (isSearch && data) {
          // Store the search results with current platforms and page number
          addRecentSearch(newQuery ?? searchQuery, data, selectedPlatforms, nextPage);
        }
      } else {
        if (data) {
          appendSearchResults(data);
          // Find and update the existing recent search with the same query and platforms
          const existingSearch = recentSearches.find(search =>
            search.term === (newQuery ?? searchQuery)
          );
          if (existingSearch) {
            // Append new results to the existing search
            addRecentSearch(
              newQuery ?? searchQuery,
              [...existingSearch.results, ...data],
              selectedPlatforms,
              nextPage
            );
          }
        }
      }
      setHasMore(true);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("previous req block by user:", err);
      }
      if (data.response.message) console.log(data.response.message)
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setLoading(false);
        setSearching(false);
        NProgress.done();
      }
    }
  };

  const fetchMoreData = () => {
    if (loading) return;
    const nextPage = searchPage + 1;
    setSearchPage(nextPage);
    fetchResults(false, nextPage);
  };

  const handleFilterChange = (platform) => {
    const newFilters = {
      ...searchFilters,
      [platform]: !searchFilters[platform],
    };
    setSearchFilters(newFilters);
  };

  const handleSortChange = (e) => {
    setSearchSort(e.target.value);
  };

  const handleWishlistToggle = (product) => {
    if (wishlistStore.isInWishlist(product)) {
      wishlistStore.removeFromWishlist(product);
    } else {
      wishlistStore.addToWishlist(product);
    }
  };

  const displayedResults = searchResults
    .sort((a, b) => {
      if (searchSort === "asc") return a.price - b.price;
      if (searchSort === "desc") return b.price - a.price;
      return 0;
    });

  const minPrice =
    displayedResults.length > 0
      ? Math.min(...displayedResults.map((item) => item.price))
      : null;

  return (
    <div className="min-h-screen  w-full mx-auto bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-800  backdrop-blur-sm rounded-2xl p-6 shadow-lg transition-colors duration-300">
      {/* <div className="w-full mx-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg"> */}
      {/* Heading with animation */}
      <h1 className="text-4xl sm:text-5xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-500 drop-shadow-xl mb-10 animate-fade-in">
        🛒 FetchMart
      </h1>

      {/* Search Bar with enhanced styling */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
        <div className="relative w-full max-w-lg group" ref={recentSearchesRef}>
          <input
            type="text"
            placeholder="Search a product..."
            className="w-full py-3 px-5 pl-6 pr-12 text-base text-gray-900 dark:text-gray-100 sm:text-lg border-2 border-blue-200 dark:border-blue-700 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all group-hover:border-blue-300 dark:group-hover:border-blue-600 bg-white dark:bg-gray-800"
            value={searchQuery}
            required
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
                setShowSuggestions(false)
              }
            }}
            onFocus={() => {
              if (searchQuery.trim()) {
                setShowSuggestions(true);
              } else {
                setShowRecentSearches(true);
              }
            }}
          />
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </span>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              <div className="p-2">
                <div className="flex justify-between items-center mb-2 px-2">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Suggestions
                  </h3>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md cursor-pointer group transition-all duration-200 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                      onClick={() => {
                        setSearchQuery(suggestion);
                        setShowSuggestions(false);
                        handleSearch(suggestion);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-1">
                          {suggestion}
                        </span>
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Searches Dropdown */}
          {showRecentSearches && recentSearches.length > 0 && searchQuery.length <= 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              <div className="p-2">
                <div className="flex justify-between items-center mb-2 px-2">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Recent Searches</h3>
                  <button
                    onClick={() => setShowRecentSearches(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {recentSearches.map((search, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md cursor-pointer group"
                  >
                    <div
                      className="flex-1 flex items-center gap-2"
                      onClick={() => handleRecentSearchClick(search.term)}
                    >
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex flex-col">
                        <span className="text-gray-700 dark:text-gray-300">{search.term}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {search.platforms.join(', ')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearRecentSearches(search.term);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setShowRecentSearches(false)
            setShowSuggestions(false)
            handleSearch()
          }}
          className="bg-gradient-to-r from-blue-500 to-pink-500 dark:from-blue-600 dark:to-pink-600 text-white font-semibold px-6 py-3 rounded-full shadow-md hover:scale-105 hover:shadow-lg transition-all duration-300"
        >
          {searching ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Searching...
            </span>
          ) : "Search"}
        </button>
      </div>

      {/* Filters and Sort with enhanced styling */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-5 mb-10">
        {Object.keys(searchFilters).map((platform) => (
          <label
            key={platform}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-all duration-300"
          >
            <input
              type="checkbox"
              checked={searchFilters[platform]}
              onChange={() => handleFilterChange(platform)}
              className="accent-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{platform}</span>
          </label>
        ))}
        <select
          value={searchSort}
          onChange={handleSortChange}
          className="bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 text-sm px-4 py-2 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 font-semibold hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300"
        >
          <option value="none">Sort by</option>
          <option value="asc">Price Low to High</option>
          <option value="desc">Price High to Low</option>
        </select>
      </div>

      {/* No Results with enhanced styling */}
      {displayedResults.length === 0 && !loading && (
        <div className="text-center mt-12 animate-fade-in">
          <p className="text-gray-600 dark:text-gray-400 text-lg">No results to show</p>
        </div>
      )}

      {/* Results Grid with enhanced card styling */}
      <InfiniteScroll
        dataLength={displayedResults.length}
        next={fetchMoreData}
        hasMore={hasMore}
        scrollThreshold={0.9}
        loader={
          loading && (
            <div className="flex justify-center mt-8">
              <button className="bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700 text-white px-6 py-2 rounded-full shadow animate-pulse">
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Loading...
                </span>
              </button>
            </div>
          )
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {displayedResults.map((product, idx) => (
            <div
              key={product.id || idx}
              className={`relative flex flex-col h-full bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow hover:shadow-2xl transition-all duration-300 border-2 ${product.price === minPrice ? "border-pink-500 ring-2 ring-pink-200 dark:ring-pink-900" : "border-transparent hover:border-blue-200 dark:hover:border-blue-700"
                }`}
            >
              {/* Platform Tag and Wishlist Button Container */}
              <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-3">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full z-10 ${{
                  Amazon: "bg-yellow-100 text-yellow-700 dark:text-yellow-300  dark:bg-yellow-900",
                  Flipkart: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
                  Meesho: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300",
                  Myntra: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
                  Ajio: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
                }[product.platform] || "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}>
                  {product.platform}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWishlistToggle(product);
                  }}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  {wishlistStore.isInWishlist(product) ? (
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  )}
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
                <div className="flex flex-col items-center mt-2 gap-1 text-sm">
                  {typeof product.reviewRating === "number" && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => {
                        const fillPercent = Math.max(0, Math.min(1, product.reviewRating - (i - 1)));
                        if (fillPercent === 1) {
                          return <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" /></svg>;
                        } else if (fillPercent === 0) {
                          return <svg key={i} className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" /></svg>;
                        } else {
                          const gradId = `grad-${idx}-${i}`;
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
                    <span className="text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900 rounded px-2 py-0.5">
                      {product.reviews}
                    </span>
                  )}
                </div>
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

              {/* Lowest Price Tag with enhanced styling */}
              {product.price === minPrice && (
                <span className="absolute top-3 right-3 bg-pink-500 text-white px-3 py-1 text-xs rounded-full shadow font-bold animate-bounce"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWishlistToggle(product);
                  }}>
                  Lowest Price
                </span>
              )}
            </div>
          ))}
        </div>
      </InfiniteScroll>
      {/* </div> */}
    </div>
  );
}

export default HomePage;
