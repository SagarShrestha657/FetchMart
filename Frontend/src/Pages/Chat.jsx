import React, { useState, useRef, useEffect } from 'react';
import useChatStore from '../States/chatStore';
import { pipeline } from '@xenova/transformers';
import { FiSend, FiArrowLeft, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const { messages, addMessage, isLoading, setLoading, clearMessages } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const initModel = async () => {
      try {
        setIsModelLoading(true);
        console.log('Initializing model...');
        
        // Initialize the model
        const textGenerator = await pipeline('text-generation', 'Xenova/distilgpt2');
        console.log('Model loaded:', textGenerator);
        
        if (!isMounted) return;

        // Test the model with a simple input
        const testInput = String("phone under 15000");
        console.log('Testing model with input:', testInput);
        
        const testResult = await textGenerator(testInput, {
          max_new_tokens: 10,
          temperature: 0.7,
          top_p: 0.95,
          do_sample: true,
        });
        
        console.log('Test result:', testResult);
        
        if (!isMounted) return;
        
        setModel(textGenerator);
        setError(null);
      } catch (error) {
        console.error('Error loading model:', error);
        if (isMounted) {
          setError('Failed to load the AI model. Please refresh the page.');
        }
      } finally {
        if (isMounted) {
          setIsModelLoading(false);
        }
      }
    };

    initModel();

    return () => {
      isMounted = false;
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !model) {
      console.log('Cannot submit:', { input: input.trim(), model: !!model });
      return;
    }

    const userInput = String(input.trim());
    addMessage({ text: userInput, sender: 'user' });
    setInput('');
    setLoading(true);
    setError(null);

    try {
      console.log('Generating response for:', userInput);
      console.log('Model:', model);
      
      // Ensure input is a string and call the model
      const result = await model(String(userInput), {
        max_new_tokens: 100,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true,
      });

      console.log('Generation result:', result);

      if (!result || typeof result !== 'string') {
        throw new Error('Invalid response from model');
      }

      // The model returns a string directly
      const responseText = result.trim();
      
      addMessage({
        text: responseText || "I'm sorry, I couldn't generate a meaningful response.",
        sender: 'ai'
      });
    } catch (error) {
      console.error('Error generating response:', error);
      setError('Failed to generate response. Please try again.');
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
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Fixed Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
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
      <div className="flex-1 overflow-y-auto scrollbar-hide bg-gray-100 dark:bg-gray-800">
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 m-4 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="p-4 space-y-4">
          {!isModelLoading && messages.length === 0 && (
            <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
              <p>No messages yet. Start a conversation!</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${message.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
          {isModelLoading && (
            <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p>Loading AI model...</p>
                <p className="text-sm mt-2">This may take a few moments</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Input Form */}
      <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(String(e.target.value))}
            placeholder={isModelLoading ? "Loading AI model..." : "Ask about products (e.g., best camera and battery phone under 15000)"}
            disabled={isModelLoading}
            className="flex-1 p-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || isModelLoading || !model}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center"
            title={isModelLoading ? "Loading AI model..." : "Send message"}
          >
            <FiSend className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat; 