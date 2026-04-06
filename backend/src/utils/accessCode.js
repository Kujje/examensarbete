import { generateCode } from './codes.js';

export function generateAccessCode(length = 5) {
  return generateCode(length);
}