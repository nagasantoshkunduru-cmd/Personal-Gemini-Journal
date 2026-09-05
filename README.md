# Personal Gemini Journal 🌌

A production-grade, full-stack AI journaling application built with React, Vite, Node.js/Express, Google Cloud Platform (Cloud Run, Firestore), Firebase Auth, and the Google Gen AI SDK.

---

## 🛡️ 1. Agentic Threat Summary (The 5 Threat Zones)

| Threat Zone | Identified Risks | Implemented Countermeasures |
|---|---|---|
| **1. Input Surfaces** | Prompt injection, XSS payload in journal transcripts, oversized audio payloads. | Strict sanitization via `sanitizeInput()` stripping scripts, null-bytes, size bounding (25k chars), schema parsing. |
| **2. Planning & Reasoning** | System instruction bypass, persona hijacking, jailbreaks. | Immutable server-side system instructions, structured JSON schemas (`responseSchema`), and strict model boundaries. |
| **3. Tool Execution** | SSRF via search queries, unvetted URI execution. | Restricted search grounding using official `googleSearch` tool; web citations sanitized and verified. |
| **4. Memory & State** | Cross-user data leakage, unauthorized reads/writes in Firestore. | Zero-insecure defaults; owner-bound path security rules (`request.auth.uid == userId`) in `/users/{userId}/entries/{entryId}`. |
| **5. Inter-System Communication** | Gemini API key leakage to client, unauthorized token replay. | Zero client-side API key exposure; all Gemini API calls routed via server-side Node.js Express proxy with resilient fallback ladder. |

---

## ✨ 2. Architecture & Key Features

* **Empathetic Multi-Turn Chat:** 4 specialized psychological personas (Socratic Guide, CBT & Stoic Mindset Coach, Creative Muse, Compassionate Active Listener).
* **Live Bidirectional Voice (Gemini Live API):** Real-time audio conversation using `gemini-3.1-flash-live-preview` over WebSockets with live interruption handling.
* **Google Search Grounding:** Mindful research grounding using `gemini-3.5-flash` with verified web citation chips.
* **Automated Reflection Synthesis:** Structured JSON extraction for takeaways, emotional energy, sentiment analytics (-1.0 to +1.0), gratitude anchors, and next-day reflection prompts.
* **Resilient Model Fallback Ladder:** Automated retry and fallback across `gemini-3.5-flash`, `gemini-3.7-flash`, `gemini-3.1-flash-lite`, and `gemini-flash-latest`.
* **Zero-Trust Firestore Security:** Complete data isolation per authenticated user UID.

---

## 🔒 3. Firestore Security Rules

Deploy these rules to Cloud Firestore to enforce strict user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Isolated user-scoped journals: /users/{userId}/entries/{entryId}
    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /{allSubcollections=**} {
        allow read, write: if isOwner(userId);
      }
    }

    // Entry collection with strict owner-only access
    match /entries/{entryId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }

    // Fallback default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🚀 4. Google Cloud Run Deployment Guide

### Prerequisites
1. **Google Cloud SDK (`gcloud` CLI)** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
2. Enable required GCP Services:
   ```bash
   gcloud services enable run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     cloudbuild.googleapis.com
   ```

### Step 1: Secure Secret Management Setup
Create and store the Gemini API key in Google Cloud Secret Manager:

```bash
# 1. Create the secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add your Gemini API key value
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the default Cloud Run Compute Service Account access to read the secret
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 2: Build & Deploy to Cloud Run
Deploy the application directly using source deployment:

```bash
# Deploy to Cloud Run with Secret Manager binding
gcloud run deploy personal-gemini-journal \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars NODE_ENV=production
```

### Step 3: Apply Required Campaign Labeling
To register the service for automated campaign challenge verification:

```bash
gcloud run services update personal-gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 5. Functional Walkthrough & Verification Steps

| Test Scenario | Action / User Interaction | Expected Result |
|---|---|---|
| **1. Cosmic Landing Page & Auth** | Open app on fresh browser or incognito as unauthenticated user. | Displays deep cosmic starfield landing page with "✦ AI-POWERED REFLECTIVE INTELLIGENCE" badge, headline, and Login/Sign Up buttons. Clicking either smoothly opens the authentication modal or starts a zero-friction guest sandbox session. |
| **2. Conversational Chat** | Select "Socratic Guide" persona, type reflection message and click Send. | Server proxy handles request, streams/returns empathetic response with 0 exposed client API keys. |
| **3. Grounded Search** | Click Search icon, enter topic (e.g., "mindfulness breathing techniques"). | Gemini grounds response using Google Search and displays verified web citation chips. |
| **4. Voice Studio** | Click microphone icon and begin speaking. | Real-time audio waveform reacts; speech transcription and audio responses stream back smoothly. |
| **5. Session Synthesis** | Click "Finish & Synthesize Session". | AI generates executive summary, mood analytics, emotional score, and tags formatted via JSON schema. |
| **6. Isolated Persistence** | Save synthesized journal entry. | Entry is persisted strictly to `/users/{userId}/entries/{entryId}` in Firestore. Other users cannot access it. |
| **7. Mood Analytics** | Switch to the "Analytics" tab in navigation. | Interactive charts render historical sentiment trends, emotion distribution, and keyword cloud. |
| **8. Security Inspector** | Click the shield icon in the top header. | Real-time audit modal confirms zero client keys, active user UID path, and deployed security rules. |