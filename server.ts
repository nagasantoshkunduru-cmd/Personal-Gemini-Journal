import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';
import { setupLiveWebSocket } from './server/gemini';

// Load local environment variables from .env
dotenv.config();

const app = express();
const PORT = 3000;

// Security & Body Parsing Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Mount API Proxy Routes
app.use('/api', apiRouter);

async function startServer() {
  const server = http.createServer(app);

  // Initialize WebSocket server for Gemini Live API Voice Conversations
  const wss = new WebSocketServer({ server, path: '/live' });
  setupLiveWebSocket(wss);

  // Vite middleware for development / Static assets for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Personal Gemini Journal] Full-stack Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[Gemini Features] Live Voice (gemini-3.1-flash-live-preview), Search Grounding (gemini-3.5-flash), Multi-turn Chat (Tiered Models) Active.`);
  });
}

startServer();
