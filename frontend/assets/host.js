// frontend/assets/host.js
import { apiGet, apiPost, API_BASE } from './api.js';

const quizSelect = document.getElementById('quizSelect');
const refreshBtn = document.getElementById('refreshQuizzes');
const createSessionBtn = document.getElementById('createSession');
const sessionInfoEl = document.getElementById('sessionInfo');

const startBtn = document.getElementById('startBtn');
const tickBtn = document.getElementById('tickBtn');

const statusBadge = document.getElementById('statusBadge');
const timerBadge = document.getElementById('timerBadge');
const bigTimerEl = document.getElementById('bigTimer');

const playersEl = document.getElementById('players');
const questionBox = document.getElementById('questionBox');
const leaderboardEl = document.getElementById('leaderboard');

let joinCode = null;
let hostCode = null;
let pollTimer = null;

let lastTickedPhaseEndsAt = null;
let isTicking = false;

// Local countdown (stable)
let uiTimer = null;
let uiPhaseEndsAt = null;
let uiLastPhaseKey = null;

// Socket client (requires socket.io client script in host.html)
const socket = window.io ? window.io(API_BASE) : null;

function ensureLocalCountdown(state) {
  const phaseKey = state?.phaseEndsAt ? String(state.phaseEndsAt) : null;

  if (!phaseKey || typeof state.timeLeftMs !== 'number') {
    uiLastPhaseKey = null;
    uiPhaseEndsAt = null;
    if (uiTimer) {
      clearInterval(uiTimer);
      uiTimer = null;
    }
    if (bigTimerEl) bigTimerEl.textContent = '-';
    return;
  }

  if (phaseKey !== uiLastPhaseKey) {
    uiLastPhaseKey = phaseKey;
    uiPhaseEndsAt = Date.now() + Math.max(0, state.timeLeftMs);
  }

  if (!uiTimer) {
    uiTimer = setInterval(() => {
      if (!bigTimerEl || !uiPhaseEndsAt) return;
      const msLeft = Math.max(0, uiPhaseEndsAt - Date.now());
      bigTimerEl.textContent = String(Math.ceil(msLeft / 1000));
    }, 200);
  }
}

function renderState(state) {
  if (statusBadge) statusBadge.textContent = `status: ${state.status}`;
  if (timerBadge) {
    timerBadge.textContent =
      state.timeLeftMs === null ? 'timeLeft: -' : `timeLeft: ${Math.ceil(state.timeLeftMs / 1000)}s`;
  }

  ensureLocalCountdown(state);

  // Players
  playersEl.innerHTML = '';
  for (const p of state.players || []) {
    const li = document.createElement('li');
    li.textContent = `${p.name} | ready: ${p.isReady ? '✅' : '❌'} | score: ${p.score}`;
    playersEl.appendChild(li);
  }

  // Question
  if (state.currentQuestion && state.status !== 'finished') {
    const q = state.currentQuestion;
    const opts = (q.options || []).map((o, i) => `<li>${i}: ${o}</li>`).join('');
    const reveal = state.reveal?.correctIndex;
    questionBox.innerHTML = `
      <div class="muted">Fråga ${q.index + 1}/${state.quiz?.totalQuestions ?? '?'}</div>
      <div><strong>${q.text}</strong></div>
      <ol class="list">${opts}</ol>
      <div class="muted">Rätt svar: ${reveal === undefined || reveal === null ? '-' : reveal}</div>
    `;
  } else if (state.status === 'finished') {
    questionBox.innerHTML = `<div><strong>Spelet är slut.</strong></div>`;
  } else {
    questionBox.innerHTML = `<div class="muted">Ingen fråga än.</div>`;
  }

  // Leaderboard
  if (leaderboardEl) {
    const sorted = [...(state.players || [])].sort((a, b) => b.score - a.score);

    let leaderText = '';
    if (sorted.length > 0) {
      const topScore = sorted[0].score;
      const leaders = sorted.filter((p) => p.score === topScore);

      if (state.status === 'finished') {
        leaderText =
          leaders.length === 1
            ? `Vinnare: ${leaders[0].name} (${topScore}p)`
            : `Oavgjort: ${leaders.map((w) => w.name).join(', ')} (${topScore}p)`;
      } else if (state.status === 'reveal') {
        leaderText =
          leaders.length === 1
            ? `Ledare: ${leaders[0].name} (${topScore}p)`
            : `Delad ledning: ${leaders.map((w) => w.name).join(', ')} (${topScore}p)`;
      }
    }

    const showLb = state.status === 'reveal' || state.status === 'finished';
    const leaderboardCard = document.getElementById('leaderboardCard');
    if (leaderboardCard) leaderboardCard.style.display = showLb ? '' : 'none';

    leaderboardEl.innerHTML = `
      <div class="row" style="justify-content: space-between;">
        <strong>Leaderboard</strong>
        <span class="muted">${leaderText}</span>
      </div>
      <ol class="list leaderboard">
        ${sorted.map((p) => `<li>${p.name} — <strong>${p.score}</strong>p</li>`).join('')}
      </ol>
    `;
  }

  startBtn.disabled = state.status !== 'lobby';
  tickBtn.disabled = !(state.status === 'question' || state.status === 'reveal');

  tryAutoTick(state).catch(() => {});
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

// Polling fallback
async function poll() {
  if (!joinCode) return;
  try {
    const state = await apiGet(`/api/sessions/${joinCode}`);
    renderState(state);
  } catch (e) {
    sessionInfoEl.textContent = `Poll error: ${e.message}`;
  }
}

function bindSocketListeners() {
  if (!socket) return;

  socket.off('state');
  socket.on('state', (state) => {
    if (!state?.joinCode) return;
    if (state.joinCode !== joinCode) return;
    renderState(state);
  });

  socket.off('connect');
  socket.on('connect', () => {
    if (joinCode) socket.emit('join', joinCode);
  });
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
      <div class="muted">Game PIN</div>
      <div class="pin-wrap" style="margin-top: 8px;">
        <span class="pin" id="pinValue">${joinCode}</span>
        <button id="copyPinBtn" type="button">Copy</button>
      </div>
      <div class="muted" style="margin-top: 8px;">Dela PIN med spelare.</div>
    `;

    const copyBtn = document.getElementById('copyPinBtn');
    const pinValue = document.getElementById('pinValue');
    if (copyBtn && pinValue) {
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(pinValue.textContent || '');
        copyBtn.textContent = 'Copied ✅';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 800);
      });
    }

    if (socket) {
      socket.emit('join', joinCode);
      bindSocketListeners();
    }

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, 1500);
    await poll();
  } catch (e) {
    alert(e.message);
  }
});

startBtn.addEventListener('click', async () => {
  try {
    if (!joinCode || !hostCode) return;
    await apiPost(`/api/sessions/${joinCode}/start`, { hostCode });
  } catch (e) {
    alert(e.message);
  }
});

tickBtn.addEventListener('click', async () => {
  try {
    if (!joinCode || !hostCode) return;
    await apiPost(`/api/sessions/${joinCode}/tick`, { hostCode });
  } catch (e) {
    alert(e.message);
  }
});

await loadPublicQuizzes();