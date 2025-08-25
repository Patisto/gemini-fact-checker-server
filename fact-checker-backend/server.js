// server.js
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize the Gemini SDK client with your API key
console.log('API Key loaded:', process.env.GEMINI_API_KEY ? 'Yes' : 'No');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use express.json() middleware to parse JSON request bodies
app.use(express.json());

// Serve static files from a 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to handle the fact-checking request
app.post('/api/check-fact', async (req, res) => {
  // Destructure both url and title from the request body
  const { url, title } = req.body;

  // Check if at least one of the fields is provided
  if (!url && !title) {
    return res.status(400).json({ error: 'Either a URL or a title is required.' });
  }

  try {
    console.log('Processing request with:', { url: !!url, title: !!title });
    
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    // The prompt is the core of the AI's instruction.
    // The content of the prompt will change based on the input type.
    let prompt;
    if (url) {
      prompt = `You are a professional fact-checker. Your task is to analyze the content of the provided URL and determine its factual accuracy. Browse the content of the URL and classify the overall factual status as 'True', 'False', or 'Suspicious'. Provide a detailed, concise, and neutral explanation for your conclusion, citing evidence from the web.

URL: ${url}`;
    } else {
      prompt = `You are a professional fact-checker. Your task is to analyze the provided title and determine its factual accuracy. Use your browsing and knowledge capabilities to find reliable information and classify the overall factual status as 'True', 'False', or 'Suspicious'. Provide a detailed, concise, and neutral explanation for your conclusion, citing evidence from the web.

Title: ${title}`;
    }

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
