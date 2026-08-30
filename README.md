# Personal Gemini Journal 🌌

A secure, production-grade, full-stack web application that reimagines digital journaling. Built with React, Node.js, Firebase, and the Gemini API, this application offers an interactive, empathetic conversational journaling experience with real-time voice capabilities, deep sentiment analysis, and robust cloud security.

## 🚀 How This Project Was Built

This project was built iteratively with a strong focus on security, architecture, and advanced AI integration:

1. **Secure Foundation & Database Isolation:** The project started by integrating Firebase Authentication and Cloud Firestore. Strict Firestore Security Rules (`request.auth.uid == userId`) were implemented from day one to ensure complete data segregation, meaning users can only access their own journal entries.
2. **Zero-Trust Backend Architecture:** To protect API keys and prevent billing abuse, a Node.js Express backend proxy was created. The frontend never holds the Gemini API key; instead, it routes all chat and summarization requests through the backend, which sanitizes inputs (using DOMPurify) and safely manages the API calls.
3. **Core Conversational AI:** Integrated multi-turn chat using the Gemini API (scaling from `gemini-2.5-flash` up to `gemini-3.7-flash`). The AI acts as an interactive journal, offering tailored personas like a Socratic Guide, CBT & Stoic Coach, Creative Muse, and Compassionate Listener.
4. **Automated AI Synthesis & Sentiment Analytics:** A pipeline was created to automatically summarize journal sessions upon completion. It extracts an executive summary, gratitude moments, actionable steps, categorical sentiment (Positive, Neutral, Negative, Mixed), and top keywords formatted strictly via JSON schema.
5. **Advanced Features (Voice & Search Grounding):** 
   - **Voice Studio:** Implemented the Gemini Live API (`gemini-3.1-flash-live-preview`) using WebSockets for real-time, low-latency bidirectional voice interactions, complete with a responsive audio waveform visualizer.
   - **Search Grounding:** Integrated the `googleSearch` tool with `gemini-3.5-flash` to allow the assistant to pull verified, up-to-date information from the web with clickable citation chips.
6. **UI/UX Polish:** Applied an accessible "Elegant Dark" design theme featuring a deep obsidian canvas with Google Blue, Lavender Purple, and Emerald Green accent harmonies.

## ✨ Key Features

* **Multi-Persona AI Chatbot:** Multi-turn conversational journaling that adapts to your emotional needs.
* **Live Voice Conversations:** Real-time bidirectional voice interaction with speech interruption handling and transcript synchronization.
* **Google Search Grounding:** Mindful Research Explorer that provides verified citation chips directly in the chat.
* **Automated Session Synthesis:** AI automatically generates takeaways, gratitude moments, and actionable next steps when you finish an entry.
* **Psychological Sentiment Analytics:** Visualizes mood trends, dominant emotions, and semantic keyword clouds over time.
* **Zero-Trust Security:** Built-in Security Inspector, strict XSS sanitization, and backend-proxied API calls.

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Tailwind CSS (Elegant Dark Theme), Lucide Icons
* **Backend:** Node.js, Express
* **Database & Auth:** Google Cloud Platform (GCP), Firebase Auth (Google Identity / Email Sandbox), Cloud Firestore
* **AI Integration:** Google Gen AI SDK (Gemini 3.7 Flash, Gemini Live API, Search Grounding)