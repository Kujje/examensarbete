import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2,
        message: 'options must have at least 2 items',
      },
    },
    correctIndex: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const QuizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    isPublic: { type: Boolean, required: true },
    accessCode: { type: String, unique: true, sparse: true },
    questions: { type: [QuestionSchema], required: true },
  },
  { timestamps: true }
);

export const Quiz = mongoose.model('Quiz', QuizSchema);