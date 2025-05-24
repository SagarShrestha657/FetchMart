import { useState, useRef } from "react";
import axios from "axios";
import InfiniteScroll from "react-infinite-scroll-component";
import NProgress from "nprogress"; // Import NProgress
import "nprogress/nprogress.css";
import { Link } from "react-router-dom";

function HomePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState("none");
  const [filters, setFilters] = useState({
    Flipkart: true,
    Amazon: true,
    Meesho: true,
    Myntra: true,
    Ajio: true,
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searching, setSearching] = useState(false);

  const cancelSource = useRef(null);

  const BACKEND_URL =
  import.meta.env.VITE_MODE === "development"
    ? "http://localhost:5001"
    : import.meta.env.VITE_BACKEND_URL;

  const fetchResults = async (reset = false, nextPage = 1, newQuery = null, isSearch = false) => {
    if (!(newQuery ?? query).trim()) return;
    setLoading(true);
    if (isSearch) setSearching(true); // Set searching if this is a search
    NProgress.start(); // Start progress bar

    if (cancelSource.current) {
      cancelSource.current.cancel();
    }
    cancelSource.current = axios.CancelToken.source();

    try {
      const selectedPlatforms = Object.keys(filters).filter((p) => filters[p]);
      const { data } = await axios.post(
        `${BACKEND_URL}/search`,
        {
          query: newQuery ?? query,
          platforms: selectedPlatforms,
          page: nextPage,
          limit: 10,
        },
        { cancelToken: cancelSource.current.token }
      );
      if (reset) {
        setResults(data);
      } else {
        setResults((prev) => [...prev, ...data]);
      }
      setHasMore(true);
    } catch (err) {
      if (!axios.isCancel(err)) alert("Error fetching results");
    }
    setLoading(false);
    setSearching(false); // <-- Reset searching after fetch
    NProgress.done(); // Stop progress bar
  };

  const handleSearch = () => {
    if (query.trim().length < 1) return;
    setSearching(true); // <-- Set searching true
    setPage(1);
    setHasMore(true);
    setResults([]);
    fetchResults(true, 1, query, true); // Pass true for isSearch
  };

  const fetchMoreData = () => {
    if (loading) return; // Prevent multiple fetches
    const nextPage = page + 1;
    setPage(nextPage);
    fetchResults(false, nextPage);
  };

  const handleFilterChange = (platform) => {
    setFilters((prev) => ({
      ...prev,
      [platform]: !prev[platform],
    }));
  };

  const handleSortChange = (e) => {
    setSort(e.target.value);
  };

  const displayedResults = results
    .sort((a, b) => {
      if (sort === "asc") return a.price - b.price;
      if (sort === "desc") return b.price - a.price;
      return 0;
    });

  const minPrice =
    displayedResults.length > 0
      ? Math.min(...displayedResults.map((item) => item.price))
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br bg-gray-500 p-2 sm:p-4 ">
      <div className="max-w-6xl mx-auto h-full">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6 sm:mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-pink-500 drop-shadow-lg">
          🛒 FetchMart
        </h1>

        <div className="flex flex-row justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="relative w-64 sm:w-80 md:w-96">
            <input
              type="text"
              placeholder="Search a product..."
              required
              className="border-2 border-blue-300 focus:border-blue-500 outline-none px-4 sm:px-5 py-2.5 sm:py-3 w-full rounded-full shadow transition text-base sm:text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </span>
          </div>
          <button
            onClick={handleSearch}
            className="w-auto bg-gradient-to-r from-blue-500 to-pink-500 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold shadow hover:scale-105 transition"
          >
            {searching ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" fill="none" /><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" /></svg>
                Searching...
              </span>
            ) : (
              "Search"
            )}
          </button>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 mb-6 sm:mb-8 pb-2 mx-auto w-full">
          {Object.keys(filters).map((platform) => (
            <label
              key={platform}
              className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full shadow-sm hover:shadow-md transition cursor-pointer whitespace-nowrap"
            >
              <input
                type="checkbox"
                checked={filters[platform]}
                onChange={() => handleFilterChange(platform)}
                className="accent-blue-500"
              />
              <span className="font-medium text-gray-700">{platform}</span>
            </label>
          ))}

          <select
            value={sort}
            onChange={handleSortChange}
            className="border-2 text-black border-blue-300 focus:border-blue-500 outline-none px-4 py-2 rounded-full shadow min-w-[120px]"
          >
            <option value="none">Sort by</option>
            <option value="asc">Price Low to High</option>
            <option value="desc">Price High to Low</option>
          </select>
        </div>

        {displayedResults.length === 0 && !loading && (
          <p className="text-center text-black text-base sm:text-lg mt-10">No results to show</p>
        )}

        <InfiniteScroll
          dataLength={displayedResults.length}
          next={fetchMoreData}
          hasMore={hasMore}
          scrollThreshold={0.9}
          loader={
            loading && (
              <div className="flex justify-center mt-8">
                <button
                  className="bg-gradient-to-r from-gray-500 to-gray-500 text-white px-6 py-2 no-b"
                >
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {displayedResults.map((product, idx) => (
              <div
                key={idx}
                className={`relative flex flex-col h-full bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-2xl transition group border-2 ${product.price === minPrice
                  ? "border-pink-500 ring-2 ring-pink-200"
                  : "border-transparent"
                  }`}
              >
                <span className={`absolute top-3 left-3 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap z-10 ${product.platform === "Amazon"
                  ? "bg-yellow-100 text-yellow-700"
                  : product.platform === "Flipkart"
                    ? "bg-blue-100 text-blue-700"
                    : product.platform === "Meesho"
                      ? "bg-pink-100 text-pink-700"
                      : product.platform === "Myntra"
                        ? "bg-purple-100 text-purple-700"
                        : product.platform === "Ajio"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                  }`}>
                  {product.platform}
                </span>
                {product.image && (
                  <div className="w-full flex justify-center items-center mb-3 min-h-[160px]">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-36 sm:h-40 w-auto max-w-full object-contain rounded-xl shadow"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex flex-col flex-1 justify-between">
                  <div className="mb-1 gap-2">
                    {/* Product Name: always two lines */}
                    <h2
                      className="font-bold text-base sm:text-lg md:text-xl text-gray-800 break-words text-center"
                      style={{
                        minHeight: "3.2em", // Ensures two lines even if short
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: "1.6em",
                      }}
                    >
                      {product.name}
                    </h2>

                    {/* Brand Row */}
                    <div className="flex justify-center mt-1 mb-2 text-xs sm:text-sm">
                      {product.brand ? (
                        <span className="font-semibold text-gray-700 h-5" >{product.brand}</span>
                      ) : (
                        <span className="inline-block w-12 h-5" />
                      )}
                    </div>
                    {/* Reviews and Star Bar Row */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mb-1 text-xs sm:text-sm flex-col">
                      {/* Star bar with partial star support */}
                      {typeof product.reviewRating === "number" && (
                        <span className="flex items-center ml-2">
                          {[1, 2, 3, 4, 5].map(i => {
                            const fillPercent = Math.max(
                              0,
                              Math.min(1, product.reviewRating - (i - 1))
                            ); // 1 = full, 0 = empty, between = partial
                            if (fillPercent === 1) {
                              // Full star
                              return (
                                <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" />
                                </svg>
                              );
                            } else if (fillPercent === 0) {
                              // Empty star
                              return (
                                <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" />
                                </svg>
                              );
                            } else {
                              // Partial star
                              const gradId = `star-grad-${idx}-${i}`;
                              return (
                                <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20">
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
                        </span>
                      )}
                      {/* Reviews text */}
                      {product.reviews ? (
                        <span className="flex items-center text-yellow-700 bg-yellow-100 rounded px-2 py-0.5">
                          <svg className="w-4 h-4 mr-1 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" /></svg>
                          {product.reviews}
                        </span>
                      ) : (
                        <span className="inline-block w-20" />
                      )}
                    </div>
                  </div>
                  {/* Price and Discount Row */}
                  <div className="flex   items-center justify-center ">
                    <p className="text-lg sm:text-xl font-extrabold text-blue-600 text-right">
                      ₹{product.price.toLocaleString()}
                    </p>
                    {product.discount && (
                      <span className="ml-2 font-semibold text-pink-600 bg-pink-100 rounded px-2 py-0.5 text-xs sm:text-sm text-left">
                        [{product.discount}]
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  to={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 bg-gradient-to-r from-blue-500 to-pink-500 text-white px-4 sm:px-5 py-2 rounded-full font-semibold shadow hover:scale-105 transition w-full text-center"
                >
                  <span className="text-white">Buy Now</span>
                </Link>
                {product.price === minPrice && (
                  <span className="absolute top-3 right-2 bg-pink-500 text-white px-2 sm:px-3 py-1 text-xs rounded-full shadow font-bold animate-bounce">
                    Lowest Price
                  </span>
                )}
              </div>
            ))}
          </div>
        </InfiniteScroll>
      </div>
    </div>
  );
}

export default HomePage;
