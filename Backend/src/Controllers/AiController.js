import axios from 'axios';

export const getAiResponse = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Add context to improve accuracy with concise response
        const prompt = `You are a product expert. For the following question, provide a brief and concise response based on the question type:

For general product questions (like "best lipstick", "good phone under 20000"):
1. Best Recommendation
   • Why it's recommended
   • Key features
   • Price in ₹

For comparison questions (like "iPhone vs Samsung", "compare these products"):
1. Comparison
   • Key differences
   • Price comparison (in ₹)
   • Best choice and why

For specific product questions (like "tell me about iPhone 14"):
1. Product Details
   • Key features
   • Price in ₹
   • Pros and cons

For recommendation questions (like "suggest a good laptop"):
1. Recommendation
   • Best option
   • Why it's recommended
   • Price in ₹
   • Alternatives if needed

Keep each section brief and to the point.
Total response should be under 150 words.
Always mention prices in Indian Rupees (₹) and not in dollars.
Start each new point on a new line.

Question: ${query}`;

        const response = await axios.post(
            "https://api.cohere.ai/v1/chat",
            {
                message: prompt,
                model: "command",
                temperature: 0.2,
                max_tokens: 300,
                p: 0.9,
                k: 0,
                return_likelihoods: "NONE",
                chat_history: [
                    {
                        role: "system",
                        message: "You are a product expert who provides concise, accurate information. Format your response based on the question type. Use bullet points and proper spacing. Keep responses under 150 words. Always mention prices in Indian Rupees (₹)."
                    }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        if (!response.data || !response.data.text) {
            throw new Error('Invalid response from API');
        }

        return res.status(200).json({ response: response.data.text });
    } catch (error) {
        console.error('Error getting AI response:', {
            message: error.message,
        });

        // Fallback responses based on the type of error
        let fallbackResponse;
        if (error.response?.status === 404) {
            fallbackResponse = "I'm having trouble accessing my knowledge base right now. Please try asking your question in a different way.";
        } else if (error.response?.status === 401) {
            fallbackResponse = "I'm having trouble authenticating with my service. Please try again later.";
        } else if (error.response?.status === 429) {
            fallbackResponse = "I'm getting too many requests right now. Please wait a moment and try again.";
        } else {
            fallbackResponse = "I apologize, but I'm having trouble providing an accurate response right now. Please try again later or rephrase your question.";
        }

        res.status(200).json({ response: fallbackResponse });
    }
}; 