// frontend/assets/host.js
import { apiGet, apiPost } from './api.js';

const quizSelect = document.getElementById('quizSelect');
const refreshBtn = document.getElementById('refreshQuizzes');
const createSessionBtn = document.getElementById('createSession');
const sessionInfoEl = document.getElementById('sessionInfo');

const startBtn = document.getElementById('startBtn');
const tickBtn = document.getElementById('tickBtn');

const statusBadge = document.getElementById('statusBadge');
const timerBadge = document.getElementById('timerBadge');
const playersEl = document.getElementById('players');
const questionBox = document.getElementById('questionBox');

let joinCode = null;
let hostCode = null;
let pollTimer = null;

// Hindrar spam: tick max 1 gång per phaseEndsAt
let lastTickedPhaseEndsAt = null;
let isTicking = false;

function renderState(state) {
  statusBadge.textContent = `status: ${state.status}`;
  timerBadge.textContent =
    state.timeLeftMs === null ? 'timeLeft: -' : `timeLeft: ${Math.ceil(state.timeLeftMs / 1000)}s`;

  playersEl.innerHTML = '';
  for (const p of state.players) {
    const li = document.createElement('li');
    li.textContent = `${p.name} | ready: ${p.isReady ? '✅' : '❌'} | score: ${p.score}`;
    playersEl.appendChild(li);
  }

  if (state.currentQuestion && state.status !== 'finished') {
    const q = state.currentQuestion;
    const opts = q.options.map((o, i) => `<li>${i}: ${o}</li>`).join('');
    const reveal = state.reveal?.correctIndex;
    questionBox.innerHTML = `
      <div><strong>Q${q.index + 1}:</strong> ${q.text}</div>
      <ol class="list">${opts}</ol>
      <div class="muted">Rätt svar: ${reveal === undefined || reveal === null ? '-' : reveal}</div>
    `;
  } else if (state.status === 'finished') {
    questionBox.innerHTML = `<div><strong>Spelet är slut.</strong></div>`;
  } else {
    questionBox.innerHTML = `<div class="muted">Ingen fråga.</div>`;
  }

  const leaderboardEl = document.getElementById('leaderboard');
  const sorted = [...state.players].sort((a, b) => b.score - a.score);

  let leaderText = '';
  if (sorted.length > 0) {
    const topScore = sorted[0].score;
    const leaders = sorted.filter((p) => p.score === topScore);
    if (state.status === 'finished') {
      leaderText =
        leaders.length === 1
          ? `Vinnare: ${leaders[0].name} (${topScore}p)`
          : `Oavgjort: ${leaders.map((w) => w.name).join(', ')} (${topScore}p)`;
    } else {
      leaderText =
        leaders.length === 1
          ? `Ledare just nu: ${leaders[0].name} (${topScore}p)`
          : `Delad ledning: ${leaders.map((w) => w.name).join(', ')} (${topScore}p)`;
    }
  }

  leaderboardEl.innerHTML = `
    <div class="row" style="justify-content: space-between;">
      <strong>Leaderboard</strong>
      <span class="muted">${leaderText}</span>
    </div>
    <ol class="list leaderboard">
      ${sorted.map((p) => `<li>${p.name} — <strong>${p.score}</strong>p</li>`).join('')}
    </ol>
  `;

  startBtn.disabled = state.status !== 'lobby';
  tickBtn.disabled = !(state.status === 'question' || state.status === 'reveal');
}

async function tryAutoTick(state) {
  if (!joinCode || !hostCode) return;
  if (!(state.status === 'question' || state.status === 'reveal')) return;
  if (state.timeLeftMs === null || state.phaseEndsAt === null) return;
  if (state.timeLeftMs > 0) return;

  const phaseId = String(state.phaseEndsAt);
  if (!phaseId || phaseId === lastTickedPhaseEndsAt) return;

  if (isTicking) return;
  isTicking = true;

  try {
    await apiPost(`/api/sessions/${joinCode}/tick`, { hostCode });
    lastTickedPhaseEndsAt = phaseId;
  } catch {
    // ignore
  } finally {
    isTicking = false;
  }
}

async function poll() {
  if (!joinCode) return;
  try {
    const state = await apiGet(`/api/sessions/${joinCode}`);
    renderState(state);
    await tryAutoTick(state);
  } catch (e) {
    sessionInfoEl.textContent = `Poll error: ${e.message}`;
  }
}

async function loadPublicQuizzes() {
  quizSelect.innerHTML = `<option value="">Loading...</option>`;
  try {
    const quizzes = await apiGet('/api/quizzes/public');

    if (!Array.isArray(quizzes) || quizzes.length === 0) {
      quizSelect.innerHTML = `<option value="">No public quizzes found</option>`;
      return;
    }

    quizSelect.innerHTML = quizzes
      .map((q) => `<option value="${q._id}">${q.title}</option>`)
      .join('');
  } catch (e) {
    quizSelect.innerHTML = `<option value="">Failed to load quizzes</option>`;
    alert(e.message);
  }
}

refreshBtn.addEventListener('click', loadPublicQuizzes);

createSessionBtn.addEventListener('click', async () => {
  try {
    const quizId = quizSelect.value;
    if (!quizId) return alert('Välj ett quiz i listan');

    const data = await apiPost('/api/sessions', { quizId });
    joinCode = data.joinCode;
    hostCode = data.hostCode;

    lastTickedPhaseEndsAt = null;
    isTicking = false;

    sessionInfoEl.innerHTML = `
      <div><strong>joinCode:</strong> ${joinCode}</div>
      <div><strong>hostCode:</strong> ${hostCode}</div>
      <div class="muted">Dela joinCode med spelare. HostCode är hemlig.</div>
    `;

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, 600);
    await poll();
  } catch (e) {
    alert(e.message);
  }
});

startBtn.addEventListener('click', async () => {
  try {
    await apiPost(`/api/sessions/${joinCode}/start`, { hostCode });
    lastTickedPhaseEndsAt = null;
    await poll();
  } catch (e) {
    alert(e.message);
  }
});

tickBtn.addEventListener('click', async () => {
  try {
    await apiPost(`/api/sessions/${joinCode}/tick`, { hostCode });
    await poll();
  } catch (e) {
    alert(e.message);
  }
});

await loadPublicQuizzes();