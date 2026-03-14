import mongoose from 'mongoose';

const PlayerSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    isReady: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const SessionSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    joinCode: { type: String, required: true, unique: true },
    hostCode: { type: String, required: true, unique: true },

    status: {
      type: String,
      enum: ['lobby', 'question', 'reveal', 'finished'],
      default: 'lobby',
    },

    currentQuestionIndex: { type: Number, default: 0 },
    phaseEndsAt: { type: Date, default: null },

    players: { type: [PlayerSchema], default: [] },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Session = mongoose.model('Session', SessionSchema);