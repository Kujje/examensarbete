// backend/src/server.js
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import { quizzesRouter } from './routes/quizzes.js';
import { sessionsRouter } from './routes/sessions.js';

import { createSocketServer } from './socket.js';
import { setIo } from './socketStore.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/quizzes', quizzesRouter);
app.use('/api/sessions', sessionsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = http.createServer(app);

// Socket.IO instance (stored globally via socketStore)
const io = createSocketServer(httpServer);
setIo(io);

const PORT = process.env.PORT || 3000;

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  httpServer.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});