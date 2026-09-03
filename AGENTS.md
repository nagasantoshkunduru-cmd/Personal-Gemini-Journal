# Production Directives & Enterprise Security Architecture

This file captures the custom security directives and enterprise-grade guidelines configured for this application in Google AI Studio for the Gen AI Academy APAC Edition Ideathon Challenge.

---

## 1. Agentic Threat Modeling (The 5 Threat Zones)
Every feature design and system update must evaluate the 5 threat zones before writing code:
- **Input Surfaces**: Prompts, untrusted user uploads, external API payloads. Sanitized using strict schema validation and string filters.
- **Planning & Reasoning**: Prompt injection, system instruction bypass, tool routing hijacking. Mitigated by server-side immutable system prompts and structured output schemas (`responseSchema`).
- **Tool Execution**: Privilege escalation via API functions, SSRF, dynamic code execution risks. Mitigated by restricting tools to vetted functions (e.g. official `googleSearch`).
- **Memory & State**: Firestore state persistence, session hijacking, cross-user data leaks. Enforced through owner-bound Firestore security rules (`request.auth.uid == userId`) and zero insecure defaults.
- **Inter-System Communication**: External API calls, token leakage. Zero client-side API keys; all Gemini API calls routed via secure server-side Express proxy.

---

## 2. Secure Coding Standard (OWASP Web & LLM Mitigations)
- **Input Validation & Sanitization (OWASP A03 / LLM02)**: Schema validation on all requests (`/api/*`), parameterization, and script tag stripping.
- **Indirect Prompt Injection Defense (OWASP LLM01)**: Untrusted inputs treated as plain data, never as executable instructions.
- **Broken Access Control Mitigation (OWASP A01)**: Authorization verification and user-bound context checks at every endpoint.
- **Output Handling (OWASP A03 / LLM05)**: Encode dynamic LLM outputs prior to rendering.

---

## 3. Secure Firestore & Firebase Auth Configuration
- **Zero Insecure Defaults**: Never permit `allow read, write: if true;`.
- **User Data Isolation**: Strict owner-bound rules:
  ```javascript
  match /users/{userId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
    match /entries/{entryId} {
      allow read, list, write: if request.auth != null && request.auth.uid == userId;
    }
  }
  ```
- **Federated Authentication**: Outsource credential management to Firebase Auth (Google Sign-In / Federated Identity) to eliminate local credential handling risks.

---

## 4. Secret Management & Zero-Hardcoding Hygiene
- **Prohibit Hardcoded Strings**: Zero hardcoded API keys in client or server code.
- **Google Cloud Secret Manager Integration**: Production deployments pull `GEMINI_API_KEY` from Google Cloud Secret Manager via Cloud Run secret volume or environment injection (`--set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest`).
- **Lazy Initialization**: Initialize Google GenAI client only when requested; gracefully fail if missing without server crash.

---

## 5. Gemini Model Resilience & Fallback Protocol
- **Fallback Ladder**:
  1. `gemini-3.6-flash` (Primary)
  2. `gemini-3.1-flash-lite` (High-Availability Fallback)
  3. `gemini-flash-latest` (Dynamic Alias)
  4. `gemini-3.7-flash` (Deep Reasoning Fallback)
- **Error Recovery**: Auto-retry on `503 UNAVAILABLE` and `429 RESOURCE_EXHAUSTED` with exponential backoff before bubbling errors to the UI.
