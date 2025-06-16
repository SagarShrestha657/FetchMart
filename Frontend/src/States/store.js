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
      searchQuery: 'Phones under 20,000',
      searchResults: [
        {
          brand: "",
          discount: "32% off",
          image: "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/2/t/7/13-5g-2406ern9ci-redmi-original-imah3gnsfhkrweza.jpeg?q=70",
          link: "https://www.flipkart.com/redmi-13-5g-hawaiian-blue-128-gb/p/itmede93b8d7b1a4?pid=MOBH2SS96VEZUVX4&lid=LSTMOBH2SS96VEZUVX4AZIF8D&marketplace=FLIPKART&q=mobile+phone+under+20000&store=tyy%2F4io&srno=s_1_10&otracker=search&fm=organic&iid=f31f393b-ab9c-437d-913f-e9d970195d86.MOBH2SS96VEZUVX4.SEARCH&ppt=None&ppn=None&ssid=gukxb9e0kw0000001750049066580&qH=a4c842b198bfd616",
          name: "REDMI 13 5G (Hawaiian Blue, 128 GB)",
          platform: "Flipkart",
          price: 12114,
          reviewRating: 4.3,
          reviews: "4.3 (37,225 reviews)"
        },
        {
          brand: "Samsung",
          discount: "[35% off]",
          image: "https://m.media-amazon.com/images/I/81nt-RGKpyL._AC_UY218_.jpg",
          link: "https://www.amazon.in/Samsung-Daybreak-Storage-Corning-Gorilla/dp/B0D812DY6P/ref=sr_1_4?dib=eyJ2IjoiMSJ9.Higc9JMQg4Bm3CYS7kXutKcjzUFZF1LseU9Cy53aWvpoMgzuecqOk6VRrhWSSyU0y4gzPsp0u83NW2qPSEAujraMizftQYCKfwAN8JcmmMD4YhoOhhs3vvLCI6PWj76BNLEOVbbbMDk5QMjdIF0zeOL8Ub_x2rKnT8hBYOk_yHpdP0nDdcLFRCoIaSKmEp1tlnh9lAAPf70Lh3loyHs3ImVy4cpX8Y-tiqnKuXQJQOU.RtEXmYuJ8im3OPaYJ4kzTg0QT6feM9Vi5_z8N-U0YKw&dib_tag=se&keywords=mobile+phone+under+20000&qid=1750049066&sr=8-4",
          name: "Samsung Galaxy M35 5G (Daybreak Blue,8GB RAM,256GB Storage)| Corning Gorilla Glass Victus+| AnTuTu Score 595K+ | Vapour Cooling Chamber | 6000mAh Battery | 120Hz Super AMOLED Display| Without Charger",
          platform: "Amazon",
          price: 17999,
          reviewRating: 4.1,
          reviews: "4.1 (10,408 reviews)"
        },
        {
          brand: "",
          discount: "23% off",
          image: "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/j/n/1/-original-imah9gtmya9qhqse.jpeg?q=70",
          link: "https://www.flipkart.com/realme-p3x-5g-midnight-blue-128-gb/p/itmab5a4b09b6ccc?pid=MOBH8VGV88UADK2Z&lid=LSTMOBH8VGV88UADK2ZH101KQ&marketplace=FLIPKART&q=mobile+phone+under+20000&store=tyy%2F4io&spotlightTagId=default_BestsellerId_tyy%2F4io&srno=s_1_5&otracker=search&fm=organic&iid=f31f393b-ab9c-437d-913f-e9d970195d86.MOBH8VGV88UADK2Z.SEARCH&ppt=None&ppn=None&ssid=gukxb9e0kw0000001750049066580&qH=a4c842b198bfd616",
          name: "realme P3x 5G (Midnight Blue, 128 GB)",
          platform: "Flipkart",
          price: 12999,
          reviewRating: 4.4,
          reviews: "4.4 (16,417 reviews)"
        },
        {
          brand: "Samsung",
          discount: "[37% off]",
          image: "https://m.media-amazon.com/images/I/71s6rRbgfuL._AC_UY218_.jpg",
          link: "https://www.amazon.in/Samsung-MediaTek-Dimensity-Charging-Upgrades/dp/B0DX5R87P8/ref=sr_1_18?dib=eyJ2IjoiMSJ9.Higc9JMQg4Bm3CYS7kXutKcjzUFZF1LseU9Cy53aWvpoMgzuecqOk6VRrhWSSyU0y4gzPsp0u83NW2qPSEAujraMizftQYCKfwAN8JcmmMD4YhoOhhs3vvLCI6PWj76BNLEOVbbbMDk5QMjdIF0zeOL8Ub_x2rKnT8hBYOk_yHpdP0nDdcLFRCoIaSKmEp1tlnh9lAAPf70Lh3loyHs3ImVy4cpX8Y-tiqnKuXQJQOU.RtEXmYuJ8im3OPaYJ4kzTg0QT6feM9Vi5_z8N-U0YKw&dib_tag=se&keywords=mobile+phone+under+20000&qid=1750049066&sr=8-18",
          name: "Samsung Galaxy M06 5G (Blazing Black, 6GB RAM, 128 GB Storage) | MediaTek Dimensity 6300 | AnTuTu Score 422K+ | 12 5G Bands | 25W Fast Charging | 4 Gen. of OS Upgrades | Without Charger",
          platform: "Amazon",
          price: 9799,
          reviewRating: 3.7,
          reviews: "3.7 (972 reviews)"
        },
        {
          brand: "",
          discount: "32% off",
          image: "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/r/g/v/-original-imahbzrrxtsbwggz.jpeg?q=70",
          link: "https://www.flipkart.com/poco-x7-5g-cosmic-silver-128-gb/p/itmb056677ede17e?pid=MOBH7YZ9GRVZTZYH&lid=LSTMOBH7YZ9GRVZTZYHHTSM13&marketplace=FLIPKART&q=mobile+phone+under+20000&store=tyy%2F4io&srno=s_1_6&otracker=search&fm=organic&iid=f31f393b-ab9c-437d-913f-e9d970195d86.MOBH7YZ9GRVZTZYH.SEARCH&ppt=None&ppn=None&ssid=gukxb9e0kw0000001750049066580&qH=a4c842b198bfd616",
          name: "POCO X7 5G (Cosmic Silver, 128 GB)",
          platform: "Flipkart",
          price: 16999,
          reviewRating: 4.3,
          reviews: "4.3 (7,897 reviews)"
        },
        {
          brand: "",
          discount: "36% off",
          image: "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/g/g/c/-original-imah3g32gf2wkdes.jpeg?q=70",
          link: "https://www.flipkart.com/infinix-note-40x-5g-palm-blue-256-gb/p/itm9c39960257804?pid=MOBH34XGH9JGS3KM&lid=LSTMOBH34XGH9JGS3KMTLDOKR&marketplace=FLIPKART&q=mobile+phone+under+20000&store=tyy%2F4io&srno=s_1_16&otracker=search&fm=organic&iid=f31f393b-ab9c-437d-913f-e9d970195d86.MOBH34XGH9JGS3KM.SEARCH&ppt=None&ppn=None&ssid=gukxb9e0kw0000001750049066580&qH=a4c842b198bfd616",
          name: "Infinix Note 40X 5G (Palm Blue, 256 GB)",
          platform: "Flipkart",
          price: 13999,
          reviewRating: 4.3,
          reviews: "4.3 (31,707 reviews)"
        },
        {
          brand: "Redmi",
          discount: "[30% off]",
          image: "https://m.media-amazon.com/images/I/81GhaMvvHTL._AC_UY218_.jpg",
          link: "https://www.amazon.in/Redmi-Hawaiian-Largest-Display-Segment/dp/B0D78X544X/ref=sr_1_19?dib=eyJ2IjoiMSJ9.Higc9JMQg4Bm3CYS7kXutKcjzUFZF1LseU9Cy53aWvpoMgzuecqOk6VRrhWSSyU0y4gzPsp0u83NW2qPSEAujraMizftQYCKfwAN8JcmmMD4YhoOhhs3vvLCI6PWj76BNLEOVbbbMDk5QMjdIF0zeOL8Ub_x2rKnT8hBYOk_yHpdP0nDdcLFRCoIaSKmEp1tlnh9lAAPf70Lh3loyHs3ImVy4cpX8Y-tiqnKuXQJQOU.RtEXmYuJ8im3OPaYJ4kzTg0QT6feM9Vi5_z8N-U0YKw&dib_tag=se&keywords=mobile+phone+under+20000&qid=1750049066&sr=8-19",
          name: "Redmi 13 5G, Hawaiian Blue, 8GB+128GB | India Debut SD 4 Gen 2 AE | 108MP Pro Grade Camera | 6.79in Largest Display in Segment",
          platform: "Amazon",
          price: 13999,
          reviewRating: 4,
          reviews: "4 (4,902 reviews)"
        },
        {
          brand: "Samsung",
          discount: "[45% off]",
          image: "https://m.media-amazon.com/images/I/81PlVwPxFRL._AC_UY218_.jpg",
          link: "https://www.amazon.in/Samsung-Moonlight-Storage-Corning-Gorilla/dp/B0D8134JH8/ref=sr_1_15?dib=eyJ2IjoiMSJ9.Higc9JMQg4Bm3CYS7kXutKcjzUFZF1LseU9Cy53aWvpoMgzuecqOk6VRrhWSSyU0y4gzPsp0u83NW2qPSEAujraMizftQYCKfwAN8JcmmMD4YhoOhhs3vvLCI6PWj76BNLEOVbbbMDk5QMjdIF0zeOL8Ub_x2rKnT8hBYOk_yHpdP0nDdcLFRCoIaSKmEp1tlnh9lAAPf70Lh3loyHs3ImVy4cpX8Y-tiqnKuXQJQOU.RtEXmYuJ8im3OPaYJ4kzTg0QT6feM9Vi5_z8N-U0YKw&dib_tag=se&keywords=mobile+phone+under+20000&qid=1750049066&sr=8-15",
          name: "Samsung Galaxy M35 5G (Moonlight Blue,6GB RAM,128GB Storage)| Corning Gorilla Glass Victus+| AnTuTu Score 595K+ | Vapour Cooling Chamber | 6000mAh Battery | 120Hz Super AMOLED Display| Without Charger",
          platform: "Amazon",
          price: 13499,
          reviewRating: 4.1,
          reviews: "4.1 (10,408 reviews)"
        },
        {
          brand: "OnePlus",
          discount: "[5% off]",
          image: "https://m.media-amazon.com/images/I/61ngWlk3zjL._AC_UY218_.jpg",
          link: "https://www.amazon.in/sspa/click?ie=UTF8&spc=MToyNDAzMDU2MjAzNTE2NzA5OjE3NTAwNDkwNjY6c3BfbXRmOjMwMDU4MjE1NzgzNTIzMjo6MDo6&url=%2FOnePlus-Snapdragon%25C2%25AE-Smarter-Lifetime-Warranty%2Fdp%2FB0F5WSDY93%2Fref%3Dsr_1_12_sspa%3Fdib%3DeyJ2IjoiMSJ9.Higc9JMQg4Bm3CYS7kXutKcjzUFZF1LseU9Cy53aWvpoMgzuecqOk6VRrhWSSyU0y4gzPsp0u83NW2qPSEAujraMizftQYCKfwAN8JcmmMD4YhoOhhs3vvLCI6PWj76BNLEOVbbbMDk5QMjdIF0zeOL8Ub_x2rKnT8hBYOk_yHpdP0nDdcLFRCoIaSKmEp1tlnh9lAAPf70Lh3loyHs3ImVy4cpX8Y-tiqnKuXQJQOU.RtEXmYuJ8im3OPaYJ4kzTg0QT6feM9Vi5_z8N-U0YKw%26dib_tag%3Dse%26keywords%3Dmobile%2Bphone%2Bunder%2B20000%26qid%3D1750049066%26sr%3D8-12-spons%26sp_csd%3Dd2lkZ2V0TmFtZT1zcF9tdGY%26psc%3D1&cr=ZAZ",
          name: "OnePlus 13s | Snapdragon® 8 Elite | Smarter with OnePlus AI | Lifetime Display Warranty | 12GB+256GB | Pink Satin",
          platform: "Amazon",
          price: 54999,
          reviewRating: null,
          reviews: ""
        },
        {
          brand: "",
          discount: "32% off",
          image: "https://rukminim2.flixcart.com/image/312/312/xif0q/mobile/v/r/z/-original-imahbzrquuzcbyv3.jpeg?q=70",
          link: "https://www.flipkart.com/poco-x7-5g-yellow-256-gb/p/itm09a41b8f384f7?pid=MOBH7YZ9NSDFC3EK&lid=LSTMOBH7YZ9NSDFC3EK54Z4YF&marketplace=FLIPKART&q=mobile+phone+under+20000&store=tyy%2F4io&srno=s_1_4&otracker=search&fm=organic&iid=f31f393b-ab9c-437d-913f-e9d970195d86.MOBH7YZ9NSDFC3EK.SEARCH&ppt=None&ppn=None&ssid=gukxb9e0kw0000001750049066580&qH=a4c842b198bfd616",
          name: "POCO X7 5G (Yellow, 256 GB)",
          platform: "Flipkart",
          price: 18999,
          reviewRating: 4.3,
          reviews: "4.3 (7,897 reviews)"
        }
      ],
      searchFilters: {
        Flipkart: true,
        Amazon: true,
        Meesho: true,
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

      // Recent searches state
      recentSearches: [], // Will store objects with {term, platforms, results, page}
      addRecentSearch: (searchTerm, results, platforms, page) =>
        set((state) => {
          // Remove any existing entry with the same search term
          const filteredSearches = state.recentSearches.filter(item => item.term !== searchTerm);

          // Add new search at the beginning
          const newSearches = [
            {
              term: searchTerm,
              platforms: Array.isArray(platforms) ? platforms : [platforms],
              results: Array.isArray(results) ? results : [results],
              page: page || 1,
            },
            ...filteredSearches
          ].slice(0, 5); // Keep only last 5 searches

          return { recentSearches: newSearches };
        }),
      clearRecentSearches: (term) =>
        set((state) => ({
          recentSearches: term
            ? state.recentSearches.filter(search => search.term !== term)
            : []
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
        hasMore: state.hasMore,
        recentSearches: state.recentSearches
      })
    }
  )
);

export default useStore; 