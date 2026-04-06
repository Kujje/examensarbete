import express from 'express';
import { Session } from '../models/Session.js';
import { Quiz } from '../models/Quiz.js';
import { generateCode, generatePin, generatePlayerId } from '../utils/codes.js';

export const sessionsRouter = express.Router();

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

// POST /api/sessions -> skapa session (PIN + hostCode)
sessionsRouter.post('/', async (req, res, next) => {
  try {
    const { quizId } = req.body || {};
    if (!quizId) return res.status(400).json({ error: 'quizId is required' });

    const quizExists = await Quiz.exists({ _id: quizId });
    if (!quizExists) return res.status(404).json({ error: 'Quiz not found' });

    let joinCode;
    let hostCode;

    for (let i = 0; i < 10; i += 1) {
      const candidate = generatePin(6);
      const exists = await Session.exists({ joinCode: candidate });
      if (!exists) {
        joinCode = candidate;
        break;
      }
    }

    for (let i = 0; i < 10; i += 1) {
      const candidate = generateCode(8);
      const exists = await Session.exists({ hostCode: candidate });
      if (!exists) {
        hostCode = candidate;
        break;
      }
    }

    if (!joinCode || !hostCode) {
      return res.status(500).json({ error: 'Could not generate codes' });
    }

    const session = await Session.create({ quizId, joinCode, hostCode });

    res.status(201).json({
      joinCode: session.joinCode,
      hostCode: session.hostCode,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:joinCode/join -> spelare går med
sessionsRouter.post('/:joinCode/join', async (req, res, next) => {
  try {
    const joinCode = normalizeCode(req.params.joinCode);
    const { name } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }

    const session = await Session.findOne({ joinCode });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.status !== 'lobby') {
      return res.status(400).json({ error: 'Game already started' });
    }

    const cleanName = name.trim().slice(0, 20);
    const playerId = generatePlayerId();

    session.players.push({ playerId, name: cleanName, isReady: false, score: 0 });
    await session.save();

    res.status(201).json({ playerId });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:joinCode/ready -> ready/unready
sessionsRouter.post('/:joinCode/ready', async (req, res, next) => {
  try {
    const joinCode = normalizeCode(req.params.joinCode);
    const { playerId, isReady } = req.body || {};

    if (!playerId) return res.status(400).json({ error: 'playerId is required' });
    if (typeof isReady !== 'boolean') {
      return res.status(400).json({ error: 'isReady must be boolean' });
    }

    const session = await Session.findOne({ joinCode });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const player = session.players.find((p) => p.playerId === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    player.isReady = isReady;
    await session.save();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:joinCode/start -> host startar spelet
sessionsRouter.post('/:joinCode/start', async (req, res, next) => {
  try {
    const joinCode = normalizeCode(req.params.joinCode);
    const { hostCode } = req.body || {};

    if (!hostCode) return res.status(400).json({ error: 'hostCode is required' });

    const session = await Session.findOne({ joinCode });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.hostCode !== normalizeCode(hostCode)) {
      return res.status(403).json({ error: 'Invalid hostCode' });
    }

    if (session.status !== 'lobby') {
      return res.status(400).json({ error: 'Session already started' });
    }

    const readyCount = session.players.filter((p) => p.isReady).length;
    if (session.players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to start' });
    }
    if (readyCount !== session.players.length) {
      return res.status(400).json({ error: 'Not all players are ready' });
    }

    session.status = 'question';
    session.currentQuestionIndex = 0;
    session.phaseEndsAt = new Date(Date.now() + 10_000);
    await session.save();

    res.json({ ok: true, status: session.status, phaseEndsAt: session.phaseEndsAt });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:joinCode/answer -> spelare svarar under question
sessionsRouter.post('/:joinCode/answer', async (req, res, next) => {
  try {
    const joinCode = normalizeCode(req.params.joinCode);
    const { playerId, optionIndex } = req.body || {};

    if (!playerId) return res.status(400).json({ error: 'playerId is required' });
    if (!Number.isInteger(optionIndex) || optionIndex < 0) {
      return res.status(400).json({ error: 'optionIndex must be an integer >= 0' });
    }

    const session = await Session.findOne({ joinCode }).populate('quizId');
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.status !== 'question') {
      return res.status(400).json({ error: 'Not accepting answers right now' });
    }

    const player = session.players.find((p) => p.playerId === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const qIndex = session.currentQuestionIndex;
    const question = session.quizId.questions[qIndex];
    if (!question) return res.status(400).json({ error: 'Invalid question index' });

    if (optionIndex >= question.options.length) {
      return res.status(400).json({ error: 'optionIndex out of range' });
    }

    session.answers ||= {};
    const key = String(qIndex);
    session.answers[key] ||= {};
    session.answers[key][playerId] = optionIndex;
    session.markModified('answers');

    await session.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:joinCode/tick -> flytta fas när tid är slut
sessionsRouter.post('/:joinCode/tick', async (req, res, next) => {
  try {
    const joinCode = normalizeCode(req.params.joinCode);
    const { hostCode } = req.body || {};

    if (!hostCode) return res.status(400).json({ error: 'hostCode is required' });

    const session = await Session.findOne({ joinCode }).populate('quizId');
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.hostCode !== normalizeCode(hostCode)) {
      return res.status(403).json({ error: 'Invalid hostCode' });
    }

    if (!session.phaseEndsAt) {
      return res.status(400).json({ error: 'No active phase' });
    }

    if (Date.now() < new Date(session.phaseEndsAt).getTime()) {
      return res.status(400).json({ error: 'Phase not finished yet' });
    }

    const qIndex = session.currentQuestionIndex;
    const question = session.quizId.questions[qIndex];
    if (!question) return res.status(400).json({ error: 'Invalid question index' });

    if (session.status === 'question') {
      const key = String(qIndex);
      const answersForQ = (session.answers && session.answers[key]) || {};

      for (const p of session.players) {
        const picked = answersForQ[p.playerId];
        if (Number(picked) === Number(question.correctIndex)) p.score += 1;
      }

      session.status = 'reveal';
      session.phaseEndsAt = new Date(Date.now() + 5_000);
      await session.save();

      return res.json({ ok: true, status: session.status, phaseEndsAt: session.phaseEndsAt });
    }

    if (session.status === 'reveal') {
      const nextIndex = qIndex + 1;

      if (nextIndex >= session.quizId.questions.length) {
        session.status = 'finished';
        session.phaseEndsAt = null;
        await session.save();
        return res.json({ ok: true, status: session.status });
      }

      session.currentQuestionIndex = nextIndex;
      session.status = 'question';
      session.phaseEndsAt = new Date(Date.now() + 10_000);
      await session.save();

      return res.json({ ok: true, status: session.status, phaseEndsAt: session.phaseEndsAt });
    }

    return res.status(400).json({ error: 'Nothing to tick in current status' });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:joinCode -> state för polling
sessionsRouter.get('/:joinCode', async (req, res, next) => {
  try {
    const joinCode = normalizeCode(req.params.joinCode);
    const session = await Session.findOne({ joinCode }).populate('quizId');

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const qIndex = session.currentQuestionIndex;
    const question =
      session.status === 'question' || session.status === 'reveal'
        ? session.quizId.questions[qIndex]
        : null;

    const timeLeftMs = session.phaseEndsAt
      ? Math.max(0, new Date(session.phaseEndsAt).getTime() - Date.now())
      : null;

    res.json({
      joinCode: session.joinCode,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      phaseEndsAt: session.phaseEndsAt,
      timeLeftMs,
      players: session.players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        isReady: p.isReady,
        score: p.score,
      })),
      quiz: {
        _id: session.quizId._id,
        title: session.quizId.title,
        totalQuestions: session.quizId.questions.length,
      },
      currentQuestion: question
        ? { index: qIndex, text: question.text, options: question.options }
        : null,
      reveal: session.status === 'reveal' ? { correctIndex: question?.correctIndex ?? null } : null,
    });
  } catch (err) {
    next(err);
  }
});