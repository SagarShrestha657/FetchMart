# 🛒 Price Comparison App

A modern web application that helps users compare product prices across multiple e-commerce platforms in real-time. Built with React frontend and Node.js backend, featuring web scraping capabilities and AI-powered product recommendations.

## ✨ Features

- **Multi-Platform Search**: Search across Amazon, Flipkart, Meesho, and Ajio
- **AI-Powered Recommendations**: Smart product suggestions and comparisons
- **Real-time Price Tracking**: Live price extraction from e-commerce sites
- **Dark/Light Mode**: Toggle between themes
- **Wishlist Management**: Save and manage favorite products
- **Product Comparison**: Side-by-side product analysis
- **Responsive Design**: Works on all devices
- **Infinite Scroll**: Seamless product browsing

## 🛠️ Tech Stack

**Frontend**: React 19, Vite, Tailwind CSS, Material-UI, Zustand, React Router
**Backend**: Node.js, Express.js, Puppeteer, Cheerio
**AI**: Cohere AI (Command model)

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Price_Comparision
   ```

2. **Install Backend Dependencies**
   ```bash
   cd Backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../Frontend
   npm install
   ```

4. **Environment Setup**
   
   Backend `.env`:
   ```env
   PORT=5001
   NODE_ENV=development
   ```

   Frontend `.env`:
   ```env
   VITE_BACKEND_URL=http://localhost:5001/api
   ```

### Running the Application

1. **Start Backend**
   ```bash
   cd Backend
   npm run dev
   ```

2. **Start Frontend**
   ```bash
   cd Frontend
   npm run dev
   ```

3. **Open Browser**
   Navigate to `http://localhost:5173`

## 📱 Usage

- **Search**: Enter product name and select platforms
- **Wishlist**: Click heart icon to save products
- **Compare**: Select products and click "Compare Selected"
- **AI Chat**: Get recommendations and product help
- **Dark Mode**: Toggle theme in bottom-right corner

## 🌐 Live Demo

[Fetch Mart](https://fetch-mart.vercel.app)

## 📁 Project Structure

```
Price_Comparision/
├── Backend/          # Node.js API server
├── Frontend/         # React application
└── README.md
```

## 🔧 Development

**Backend Scripts:**
- `npm start` - Production server
- `npm run dev` - Development server

**Frontend Scripts:**
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run lint` - Code linting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## ⚠️ Disclaimer

This application is for educational use only. Please respect e-commerce platforms' terms of service.

---

**Built with ❤️ using React, Node.js, and modern web technologies** 