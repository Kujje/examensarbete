import express from 'express';
import { Quiz } from '../models/Quiz.js';
import { generateAccessCode } from '../utils/accessCode.js';

export const quizzesRouter = express.Router();

// GET /api/quizzes/public -> lista publika quiz (bara metadata)
quizzesRouter.get('/public', async (_req, res, next) => {
  try {
    const quizzes = await Quiz.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .select({ title: 1, createdAt: 1 });

    res.json(quizzes);
  } catch (err) {
    next(err);
  }
});

// GET /api/quizzes/code/:code -> hämta privat quiz via kod
quizzesRouter.get('/code/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();

    const quiz = await Quiz.findOne({ isPublic: false, accessCode: code });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found for this code' });

    res.json(quiz);
  } catch (err) {
    next(err);
  }
});

// GET /api/quizzes/:id -> hämta quiz via id (för att spela publika)
quizzesRouter.get('/:id', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // MVP: vi låter även privata gå att hämta via id om man råkar ha id,
    // men i frontend kommer vi bara använda detta för public.
    res.json(quiz);
  } catch (err) {
    next(err);
  }
});

// POST /api/quizzes -> skapa quiz
quizzesRouter.post('/', async (req, res, next) => {
  try {
    const { title, isPublic, questions } = req.body || {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'isPublic must be boolean' });
    }
    if (!Array.isArray(questions) || questions.length < 1) {
      return res.status(400).json({ error: 'questions must be a non-empty array' });
    }

    let accessCode;
    if (!isPublic) {
      // Försök generera en unik kod
      for (let i = 0; i < 5; i += 1) {
        const candidate = generateAccessCode(5);
        const exists = await Quiz.exists({ accessCode: candidate });
        if (!exists) {
          accessCode = candidate;
          break;
        }
      }
      if (!accessCode) return res.status(500).json({ error: 'Could not generate access code' });
    }

    const quiz = await Quiz.create({
      title: title.trim(),
      isPublic,
      accessCode,
      questions,
    });

    res.status(201).json({
      _id: quiz._id,
      title: quiz.title,
      isPublic: quiz.isPublic,
      accessCode: quiz.accessCode,
      createdAt: quiz.createdAt,
    });
  } catch (err) {
    next(err);
  }
});