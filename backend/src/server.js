import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { quizzesRouter } from './routes/quizzes.js';
import { sessionsRouter } from './routes/sessions.js';

const app = express();

app.use(cors());
app.use(express.json());


app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

app.use('/api/quizzes', quizzesRouter);
app.use('/api/sessions', sessionsRouter);

const PORT = process.env.PORT || 3000;

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.log('Failed to start:', err.message);
  process.exit(1);
});