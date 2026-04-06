import { apiPost } from './api.js';

const titleEl = document.getElementById('title');
const isPublicEl = document.getElementById('isPublic');
const questionsEl = document.getElementById('questions');

const addQuestionBtn = document.getElementById('addQuestion');
const saveQuizBtn = document.getElementById('saveQuiz');
const resultEl = document.getElementById('result');

function createQuestionCard(index) {
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.dataset.qIndex = String(index);

  wrap.innerHTML = `
    <div class="row" style="justify-content: space-between;">
      <strong>Fråga ${index + 1}</strong>
      <button type="button" class="removeQuestion">Ta bort</button>
    </div>

    <div style="margin-top: 10px;">
      <input class="qText" placeholder="Skriv frågan..." style="width: 100%;" />
    </div>

    <div style="margin-top: 10px;">
      <div class="muted">Svarsalternativ (3 st) + markera rätt:</div>

      <div class="row" style="margin-top: 8px;">
        <input class="opt" placeholder="Alternativ 1" style="flex: 1;" />
        <label class="row" style="gap: 6px;">
          <input type="radio" name="correct_${index}" class="correct" value="0" checked />
          Rätt
        </label>
      </div>

      <div class="row" style="margin-top: 8px;">
        <input class="opt" placeholder="Alternativ 2" style="flex: 1;" />
        <label class="row" style="gap: 6px;">
          <input type="radio" name="correct_${index}" class="correct" value="1" />
          Rätt
        </label>
      </div>

      <div class="row" style="margin-top: 8px;">
        <input class="opt" placeholder="Alternativ 3" style="flex: 1;" />
        <label class="row" style="gap: 6px;">
          <input type="radio" name="correct_${index}" class="correct" value="2" />
          Rätt
        </label>
      </div>
    </div>
  `;

  wrap.querySelector('.removeQuestion').addEventListener('click', () => {
    wrap.remove();
    renumberQuestions();
  });

  return wrap;
}

function renumberQuestions() {
  const cards = [...questionsEl.querySelectorAll('.card[data-q-index]')];
  cards.forEach((card, idx) => {
    card.dataset.qIndex = String(idx);
    card.querySelector('strong').textContent = `Fråga ${idx + 1}`;

    card.querySelectorAll('input.correct').forEach((r) => {
      r.name = `correct_${idx}`;
    });
  });
}

function getQuizPayload() {
  const title = titleEl.value.trim();
  const isPublic = !!isPublicEl.checked;

  if (!title) throw new Error('Skriv en titel.');

  const cards = [...questionsEl.querySelectorAll('.card[data-q-index]')];
  if (cards.length === 0) throw new Error('Lägg till minst 1 fråga.');

  const questions = cards.map((card, idx) => {
    const text = card.querySelector('.qText').value.trim();
    const options = [...card.querySelectorAll('input.opt')].map((i) => i.value.trim());
    const correctRadio = card.querySelector('input.correct:checked');
    const correctIndex = correctRadio ? Number(correctRadio.value) : 0;

    if (!text) throw new Error(`Fråga ${idx + 1} saknar text.`);
    if (options.some((o) => !o)) throw new Error(`Fråga ${idx + 1} måste ha 3 alternativ.`);

    return { text, options, correctIndex };
  });

  return { title, isPublic, questions };
}

addQuestionBtn.addEventListener('click', () => {
  const index = questionsEl.querySelectorAll('.card[data-q-index]').length;
  questionsEl.appendChild(createQuestionCard(index));
});

saveQuizBtn.addEventListener('click', async () => {
  try {
    resultEl.textContent = '';
    const payload = getQuizPayload();

    const created = await apiPost('/api/quizzes', payload);

    const id = created?._id || '(ok)';
    const accessCode = created?.accessCode;

    resultEl.innerHTML = payload.isPublic
      ? `✅ Quiz sparat! <div><strong>id:</strong> ${id}</div>`
      : `✅ Quiz sparat (privat)! <div><strong>id:</strong> ${id}</div>
         <div><strong>accessCode:</strong> ${accessCode || '(saknas i svar)'}</div>`;
  } catch (e) {
    resultEl.textContent = `❌ ${e.message}`;
  }
});

questionsEl.appendChild(createQuestionCard(0));