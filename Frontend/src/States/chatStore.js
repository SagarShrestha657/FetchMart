import { create } from 'zustand';

const useChatStore = create((set) => ({
  messages: JSON.parse(localStorage.getItem('chatMessages')) || [],
  isLoading: false,
  
  addMessage: (message) => {
    set((state) => {
      const newMessages = [...state.messages, message];
      localStorage.setItem('chatMessages', JSON.stringify(newMessages));
      return { messages: newMessages };
    });
  },
  
  setLoading: (status) => set({ isLoading: status }),
  
  clearMessages: () => {
    localStorage.removeItem('chatMessages');
    set({ messages: [] });
  },
}));

export default useChatStore; 