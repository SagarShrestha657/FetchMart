import React, { useState, useRef, useEffect } from 'react';
import useChatStore from '../States/chatStore';
import { FiSend, FiArrowLeft, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Chat = () => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const { messages, addMessage, isLoading, setLoading, clearMessages } = useChatStore();
  const navigate = useNavigate();

  const BACKEND_URL =
    import.meta.env.MODE === "development"
      ? "http://localhost:5001/api"
      : import.meta.env.VITE_BACKEND_URL;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) {
      console.log('Cannot submit: empty input');
      return;
    }

    const userInput = input.trim();
    addMessage({ text: userInput, sender: 'user' });
    setInput('');
    setLoading(true);
    setError(null);

    try {
      console.log('Sending request to backend:', userInput);   
      
      const response = await axios.post(`${BACKEND_URL}/ai-response`, { 
        query: userInput
      });

      console.log('Backend response:', response.data);

      if (!response.data || !response.data.response) {
        throw new Error('Invalid response from server');
      }

      addMessage({
        text: response.data.response,
        sender: 'ai'
      });
    } catch (error) {
      console.error('Error getting response:', error);
      setError('Failed to get response. Please try again.');
      addMessage({
        text: "Sorry, I encountered an error while processing your request. Please try again.",
        sender: 'ai'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear all messages?')) {
      clearMessages();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
      {/* Fixed Header */}
      <div className="sticky top-16 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          <FiArrowLeft className="mr-2" />
          Back to Home
        </button>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">AI Assistant</h1>
        <button
          onClick={handleClearChat}
          className="flex items-center text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          title="Clear chat"
        >
          <FiTrash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Messages Container */}
      <div className="flex-1 overflow-y-auto scrollbar-hide bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        {error && (
          <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 m-4 rounded-lg relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-lg font-medium">No messages yet</p>
                <p className="text-sm mt-2">Start a conversation with our AI assistant!</p>
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input Form */}
      <div className="sticky bottom-0 z-10 p-4 border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about products (e.g., best camera and battery phone under 15000)"
            disabled={isLoading}
            className="flex-1 p-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 shadow-sm"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center shadow-sm transition-all duration-200"
            title="Send message"
          >
            <FiSend className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat; 