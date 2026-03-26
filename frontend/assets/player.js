// frontend/assets/player.js
import { apiGet, apiPost } from './api.js';

const joinCodeEl = document.getElementById('joinCode');
const nameEl = document.getElementById('name');
const joinBtn = document.getElementById('joinBtn');
const readyBtn = document.getElementById('readyBtn');

const statusBadge = document.getElementById('statusBadge');
const timerBadge = document.getElementById('timerBadge');
const infoEl = document.getElementById('info');

const questionBox = document.getElementById('questionBox');
const answersEl = document.getElementById('answers');
const revealEl = document.getElementById('reveal');

let joinCode = null;
let playerId = null;
let pollTimer = null;
let lastPickedIndex = null;

function secondsLeft(ms) {
  if (ms === null || ms === undefined) return '-';
  return `${Math.ceil(ms / 1000)}s`;
}

function setNotJoinedUi() {
  statusBadge.textContent = 'status: -';
  timerBadge.textContent = 'timeLeft: -';
  infoEl.textContent = 'Inte joined ännu. Skriv joinCode + namn och tryck Join.';
  readyBtn.disabled = true;
  questionBox.textContent = 'Ingen fråga än.';
  answersEl.innerHTML = '';
  revealEl.textContent = '';
}

setNotJoinedUi();

async function poll() {
  if (!joinCode) return;
  try {
    const state = await apiGet(`/api/sessions/${joinCode}`);
    render(state);
  } catch (e) {
    infoEl.textContent = `Poll error: ${e.message}`;
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 700);
  poll().catch(() => {});
}

function render(state) {
  statusBadge.textContent = `status: ${state.status}`;
  timerBadge.textContent = `timeLeft: ${secondsLeft(state.timeLeftMs)}`;

  const me = state.players.find((p) => p.playerId === playerId);
  infoEl.textContent = `${playerId ? `playerId: ${playerId}` : 'playerId: (inte joined)'} | ${
    me ? `score: ${me.score}` : 'score: ?'
  }`;

  readyBtn.disabled = !playerId || state.status !== 'lobby';
  readyBtn.textContent = me?.isReady ? 'Ready ✅' : 'Ready';

  const lb = document.getElementById('leaderboard');
  if (lb) {
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    const topScore = sorted.length ? sorted[0].score : 0;
    const winners = sorted.filter((p) => p.score === topScore);

    let header = '';
    if (sorted.length) {
      if (state.status === 'finished') {
        header =
          winners.length === 1
            ? `Vinnare: ${winners[0].name} (${topScore}p)`
            : `Oavgjort: ${winners.map((w) => w.name).join(', ')} (${topScore}p)`;
      } else {
        header =
          winners.length === 1
            ? `Ledare: ${winners[0].name} (${topScore}p)`
            : `Delad ledning: ${winners.map((w) => w.name).join(', ')} (${topScore}p)`;
      }
    }

    lb.innerHTML = `
      <div class="muted">${header}</div>
      <ol class="list leaderboard">
        ${sorted
          .map((p) => {
            const isMe = p.playerId === playerId;
            return `<li>${isMe ? '<strong>DU</strong> ' : ''}${p.name} — <strong>${p.score}</strong>p</li>`;
          })
          .join('')}
      </ol>
    `;
  }

  if (state.status === 'finished') {
    answersEl.innerHTML = '';
    questionBox.textContent = 'Spelet är slut.';
    revealEl.textContent = `Din score: ${me ? me.score : '?'}`;
    return;
  }

  if (!state.currentQuestion) {
    questionBox.textContent = 'Ingen fråga än.';
    answersEl.innerHTML = '';
    revealEl.textContent = '';
    return;
  }

  const q = state.currentQuestion;
  questionBox.textContent = `Q${q.index + 1}: ${q.text}`;

  const canAnswer =
    state.status === 'question' &&
    playerId &&
    (state.timeLeftMs === null || state.timeLeftMs > 0);

  answersEl.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = opt;
    btn.disabled = !canAnswer;

    btn.addEventListener('click', async () => {
      try {
        await apiPost(`/api/sessions/${joinCode}/answer`, { playerId, optionIndex: idx });
        lastPickedIndex = idx;
        revealEl.textContent = `Svar skickat: "${opt}"`;
      } catch (e) {
        revealEl.textContent = `Svar misslyckades: ${e.message}`;
      }
    });

    answersEl.appendChild(btn);
  });

  if (state.status === 'reveal' && state.reveal?.correctIndex !== null && state.reveal?.correctIndex !== undefined) {
    const correct = state.reveal.correctIndex;
    const correctText = q.options[correct];
    const pickedText = lastPickedIndex === null ? 'Inget' : q.options[lastPickedIndex];
    revealEl.textContent = `Rätt: ${correctText}. Ditt: ${pickedText}.`;
  }
}

joinBtn.addEventListener('click', async () => {
  try {
    joinCode = joinCodeEl.value.trim().toUpperCase();
    const name = nameEl.value.trim();

    if (!joinCode) return alert('Skriv joinCode');
    if (!name) return alert('Skriv namn');

    const data = await apiPost(`/api/sessions/${joinCode}/join`, { name });
    playerId = data.playerId;
    lastPickedIndex = null;

    startPolling();
  } catch (e) {
    alert(e.message);
  }
});

readyBtn.addEventListener('click', async () => {
  try {
    if (!joinCode || !playerId) return;
    await apiPost(`/api/sessions/${joinCode}/ready`, { playerId, isReady: true });
    await poll();
  } catch (e) {
    alert(e.message);
  }
});