import { apiGet, apiPost, API_BASE } from './api.js';

const joinCodeEl = document.getElementById('joinCode');
const nameEl = document.getElementById('name');
const joinBtn = document.getElementById('joinBtn');
const readyBtn = document.getElementById('readyBtn');

const statusBadge = document.getElementById('statusBadge');
const timerBadge = document.getElementById('timerBadge');
const bigTimerEl = document.getElementById('bigTimer');
const infoEl = document.getElementById('info');

const questionTitleEl = document.getElementById('questionTitle');
const questionBox = document.getElementById('questionBox');
const answersEl = document.getElementById('answers');
const revealEl = document.getElementById('reveal');

const leaderboardEl = document.getElementById('leaderboard');
const questionCard = questionBox?.closest('.card') || null;
const leaderboardCard = leaderboardEl?.closest('.card') || null;

let joinCode = null;
let playerId = null;
let pollTimer = null;
let lastPickedIndex = null;
let uiTimer = null;
let uiPhaseEndsAt = null;

// Socket client (needs CDN script in HTML)
const socket = window.io ? window.io(API_BASE) : null;

function startLocalCountdown(phaseEndsAt) {
  uiPhaseEndsAt = phaseEndsAt ? new Date(phaseEndsAt).getTime() : null;

  if (uiTimer) clearInterval(uiTimer);

  uiTimer = setInterval(() => {
    if (!bigTimerEl || !uiPhaseEndsAt) {
      if (bigTimerEl) bigTimerEl.textContent = '-';
      return;
    }
    const msLeft = Math.max(0, uiPhaseEndsAt - Date.now());
    bigTimerEl.textContent = String(Math.ceil(msLeft / 1000));
  }, 250);
}

function secondsLeft(ms) {
  if (ms === null || ms === undefined) return '-';
  return `${Math.ceil(ms / 1000)}s`;
}

function show(el) {
  if (el) el.style.display = '';
}

function hide(el) {
  if (el) el.style.display = 'none';
}

function setNotJoinedUi() {
  if (statusBadge) statusBadge.textContent = 'status: -';
  if (timerBadge) timerBadge.textContent = 'timeLeft: -';
  if (bigTimerEl) bigTimerEl.textContent = '-';

  infoEl.textContent = 'Skriv Game PIN + namn och tryck Join.';
  readyBtn.disabled = true;

  if (questionTitleEl) questionTitleEl.textContent = 'Fråga';
  questionBox.textContent = 'Ingen fråga än.';
  answersEl.innerHTML = '';
  revealEl.textContent = '';

  hide(questionCard);
  hide(leaderboardCard);
}

async function poll() {
  if (!joinCode) return;
  try {
    const state = await apiGet(`/api/sessions/${joinCode}`);
    render(state);
  } catch (e) {
    infoEl.textContent = `Poll error: ${e.message}`;
  }
}

function startPollingFallback() {
  if (pollTimer) clearInterval(pollTimer);
  // Poll mindre ofta nu när socket pushar state
  pollTimer = setInterval(poll, 2000);
  poll().catch(() => {});
}

function stopPollingFallback() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function renderLeaderboard(state) {
  if (!leaderboardEl) return;

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

  leaderboardEl.innerHTML = `
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

function render(state) {
  if (statusBadge) statusBadge.textContent = `status: ${state.status}`;
  if (timerBadge) timerBadge.textContent = `timeLeft: ${secondsLeft(state.timeLeftMs)}`;
  if (bigTimerEl) {
    bigTimerEl.textContent =
      state.timeLeftMs === null ? '-' : String(Math.ceil(state.timeLeftMs / 1000));
  }

  const me = state.players.find((p) => p.playerId === playerId);

  // Lobby view
  if (state.status === 'lobby') {
    readyBtn.disabled = !playerId;
    readyBtn.textContent = me?.isReady ? 'Ready ✅' : 'Ready';

    const myName = me?.name || nameEl.value.trim() || 'du';
    infoEl.textContent = me
      ? `Du är med som ${myName}. Väntar på att hosten startar…`
      : 'Tryck Join för att gå med.';

    if (questionTitleEl) questionTitleEl.textContent = 'Fråga';
    hide(questionCard);
    hide(leaderboardCard);
    revealEl.textContent = '';
    return;
  }

  // Game view
  show(questionCard);

  if (state.status === 'reveal' || state.status === 'finished') show(leaderboardCard);
  else hide(leaderboardCard);

  infoEl.textContent = me ? `Poäng: ${me.score}` : 'Poäng: -';

  // Finished
  if (state.status === 'finished') {
    answersEl.innerHTML = '';
    questionBox.textContent = 'Spelet är slut.';

    const total = state.quiz?.totalQuestions ?? '?';
    const score = me ? me.score : '?';
    revealEl.textContent = `Din poäng: ${score}/${total}`;

    renderLeaderboard(state);
    return;
  }

  // Safe guard
  if (!state.currentQuestion) {
    if (questionTitleEl) questionTitleEl.textContent = 'Fråga';
    questionBox.textContent = 'Väntar på fråga...';
    answersEl.innerHTML = '';
    revealEl.textContent = '';
    return;
  }

  const q = state.currentQuestion;

  if (questionTitleEl) {
    questionTitleEl.textContent = `Fråga ${q.index + 1}/${state.quiz.totalQuestions}`;
  }

  questionBox.textContent = q.text;

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
        revealEl.textContent = 'Svar skickat ✅';
      } catch (e) {
        revealEl.textContent = `Svar misslyckades: ${e.message}`;
      }
    });

    answersEl.appendChild(btn);
  });

  // Reveal
  if (
    state.status === 'reveal' &&
    state.reveal?.correctIndex !== null &&
    state.reveal?.correctIndex !== undefined
  ) {
    const correct = state.reveal.correctIndex;
    const correctText = q.options[correct];
    const pickedText = lastPickedIndex === null ? 'Inget' : q.options[lastPickedIndex];
    revealEl.textContent = `Rätt: ${correctText}. Ditt: ${pickedText}.`;
    renderLeaderboard(state);
  } else {
    revealEl.textContent = '';
  }
  startLocalCountdown(state.phaseEndsAt);
}

function bindSocketStateListener() {
  if (!socket) return;

  socket.off('state');
  socket.on('state', (state) => {
    // ignore other sessions
    if (!state || !state.joinCode || state.joinCode !== joinCode) return;
    render(state);
  });

  // optional: if socket reconnects, re-join room
  socket.off('connect');
  socket.on('connect', () => {
    if (joinCode) socket.emit('join', joinCode);
  });
}

joinBtn.addEventListener('click', async () => {
  try {
    joinCode = joinCodeEl.value.trim().toUpperCase();
    const name = nameEl.value.trim();

    if (!joinCode) return alert('Skriv Game PIN');
    if (!name) return alert('Skriv namn');

    const data = await apiPost(`/api/sessions/${joinCode}/join`, { name });
    playerId = data.playerId;
    lastPickedIndex = null;

    // Join socket room and listen for state
    if (socket) {
      socket.emit('join', joinCode);
      bindSocketStateListener();
    }

    // Keep polling as fallback (less frequent)
    startPollingFallback();

    // One immediate fetch so UI updates right away
    await poll();
  } catch (e) {
    alert(e.message);
  }
});

readyBtn.addEventListener('click', async () => {
  try {
    if (!joinCode || !playerId) return;
    await apiPost(`/api/sessions/${joinCode}/ready`, { playerId, isReady: true });

    // state will be pushed via socket, but polling fallback exists
    await poll();
  } catch (e) {
    alert(e.message);
  }
});

// If socket exists, keep listener ready (will start rendering after joinCode is set)
if (socket) {
  bindSocketStateListener();
}

// Initial UI
stopPollingFallback();
setNotJoinedUi();