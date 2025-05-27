import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set, get) => ({
      // Dark mode state
      isDarkMode: false,
      toggleDarkMode: () => {
        const currentMode = get().isDarkMode;
        const newMode = !currentMode;
        console.log('Dark mode toggle:', {
          currentMode,
          newMode,
          type: typeof currentMode
        });
        set({ isDarkMode: newMode });
      },

      // Wishlist state
      wishlist: [],
      addToWishlist: (product) => {
        const currentWishlist = get().wishlist;
        const isDuplicate = currentWishlist.some(
          item => item.platform === product.platform && item.name === product.name
        );
        if (!isDuplicate) {
          set({ wishlist: [...currentWishlist, product] });
        }
      },
      removeFromWishlist: (product) => {
        set({
          wishlist: get().wishlist.filter(
            item => !(item.platform === product.platform && item.name === product.name)
          ),
        });
      },
      clearWishlist: () => {
        set({ wishlist: [] });
      },
      isInWishlist: (product) => {
        return get().wishlist.some(
          item => item.platform === product.platform && item.name === product.name
        );
      },

      // Search state
      searchQuery: '',
      searchResults: [],
      searchFilters: {
        Flipkart: true,
        Amazon: true,
        Meesho: true,
        Myntra: false,
        Ajio: true,
      },
      searchSort: 'none',
      searchPage: 1,
      hasMore: true,
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSearchResults: (results) => set({ searchResults: results }),
      setSearchFilters: (filters) => set({ searchFilters: filters }),
      setSearchSort: (sort) => set({ searchSort: sort }),
      setSearchPage: (page) => set({ searchPage: page }),
      setHasMore: (hasMore) => set({ hasMore }),
      appendSearchResults: (newResults) => set((state) => ({
        searchResults: [...state.searchResults, ...newResults]
      })),
      resetSearch: () => set({
        searchQuery: '',
        searchResults: [],
        searchPage: 1,
        hasMore: true
      }),

      // Recent searches state
      recentSearches: [],
      addRecentSearch: (searchTerm) =>
        set((state) => ({
          recentSearches: [
            searchTerm,
            ...state.recentSearches.filter((term) => term !== searchTerm),
          ].slice(0, 5), // Keep only last 5 searches
        })),
      clearRecentSearches: () =>
        set(() => ({
          recentSearches: [],
        })),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        wishlist: state.wishlist,
        searchQuery: state.searchQuery,
        searchResults: state.searchResults,
        searchFilters: state.searchFilters,
        searchSort: state.searchSort,
        searchPage: state.searchPage,
        hasMore: state.hasMore
      })
    }
  )
);

export default useStore; 