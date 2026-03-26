# Quiz App (Examensarbete) – Fullstack (Vanilla JS + Node/Express + MongoDB)

En webbaserad quiz-applikation där man kan skapa quiz och köra ett live-quiz i realtid (MVP med polling).
Projektet visar fullstack-flöde: frontend → REST API → MongoDB Atlas.

## Teknisk stack
- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express
- Databas: MongoDB Atlas (Mongoose)
- Versionhantering: Git/GitHub

---

## Funktioner (MVP)
### Quiz
- Skapa quiz (public eller private)
- Public quiz listas i host-vyn
- Private quiz kan hämtas via kod (backend-stöd)

### Live-quiz
- Host skapar en live-session kopplad till ett quiz
- Spelare joinar med `joinCode`, skriver namn och klickar Ready
- Host startar spelet när minst 2 spelare är ready
- Frågor körs med timer:
  - `question` (10 sek) → `reveal` (5 sek) → nästa fråga → `finished`
- Poäng räknas per fråga
- Leaderboard + vinnare/oavgjort visas

---

## Projektstruktur
```txt
Examensarbete/
  backend/
    src/
      server.js
      routes/
      models/
      utils/
  frontend/
    index.html
    host.html
    player.html
    create.html
    assets/
      app.css
      api.js
      host.js
      player.js
      create.js