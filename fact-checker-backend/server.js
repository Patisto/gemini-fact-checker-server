// server.js
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize the Gemini SDK client with your API key
console.log('API Key loaded:', process.env.GEMINI_API_KEY ? 'Yes' : 'No');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure CORS to allow your frontend domain
const corsOptions = {
  origin: [
    'https://truth-lensnetlifyapp.netlify.app',
    'https://truthlensnetlify.netlify.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Use express.json() middleware to parse JSON request bodies
app.use(express.json());

// Serve static files from a 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to handle the fact-checking request
app.post('/api/check-fact', async (req, res) => {
  // Only accept URL from the request body
  const { url } = req.body;

  // Check if URL is provided
  if (!url) {
    return res.status(400).json({ error: 'A URL is required.' });
  }

  try {
    console.log('Processing request with URL:', url);
    
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    // The prompt for URL fact-checking
    const prompt = `You are a professional fact-checker. Your task is to analyze the content of the provided URL and determine its factual accuracy. Browse the content of the URL and classify the overall factual status as 'True', 'False', or 'Suspicious'. Provide a detailed, concise, and neutral explanation for your conclusion, citing evidence from the web.

URL: ${url}`;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "status": {
              "type": "STRING",
              "enum": ["True", "False", "Suspicious"]
            },
            "explanation": {
              "type": "STRING"
            }
          },
          propertyOrdering: ["status", "explanation"]
        }
      }
    });

    // Get the response text and parse it as JSON
    const responseText = await result.response.text();
    const response = JSON.parse(responseText);
    res.json(response);

  } catch (error) {
    console.error('API call error:', error);
    
    // Provide more specific error messages
    if (error.message?.includes('API_KEY')) {
      return res.status(500).json({ error: 'Invalid or missing Gemini API key. Please check your environment configuration.' });
    }
    
    if (error.message?.includes('model')) {
      return res.status(500).json({ error: 'Invalid model configuration. Please check the Gemini model name.' });
    }
    
    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      return res.status(429).json({ error: 'API quota exceeded. Please try again later.' });
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze the input. Please check your URL or title and try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
