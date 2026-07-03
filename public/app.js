const app = document.querySelector("#app");
const state = {
  name: localStorage.getItem("shakbata:name") || "",
  code: (new URLSearchParams(location.search).get("room") || new URLSearchParams(location.search).get("code") || "").trim().toUpperCase(),
  playerId: localStorage.getItem("shakbata:playerId") || "",
  room: null,
  source: null,
  tool: "pen",
  color: "#111827",
  size: 7,
  strokes: [],
  isDrawing: false,
  strokeId: "",
  lastSentAt: 0,
  pendingPoints: [],
  renderKey: "",
  drawEventCursor: 0,
  pendingRenderKey: ""
};

function html(strings, ...values) {
  return strings.map((string, index) => string + (values[index] ?? "")).join("");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function compactName(name = "", max = 9) {
  const text = String(name);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function roomLink(code) {
  const url = new URL(location.origin);
  url.searchParams.set("room", code);
  return url.toString();
}

function clearRoomLink() {
  if (location.search) history.replaceState(null, "", location.pathname);
}

async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "حصل خطأ.");
  return data;
}

function setError(message) {
  const element = document.querySelector("[data-error]");
  if (element) element.textContent = message || "";
}

function connect(room, playerId) {
  if (state.source) state.source.close();
  state.source = new EventSource(`/events?room=${room.code}&player=${playerId}`);
  state.source.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.type === "state") {
      const didRender = applyRoomState(data.room);
      syncDrawEvents(data.room.drawEvents, didRender);
    }
  };
  state.source.onerror = () => setError("الاتصال بيحاول يرجع تاني...");
}

function isLocalDrawerDrawing() {
  return state.isDrawing && state.room?.status === "playing" && state.room.drawerId === state.playerId;
}

function roomRenderKey(room) {
  return JSON.stringify({
    code: room.code,
    isPublic: room.isPublic,
    status: room.status,
    round: room.round,
    totalRounds: room.totalRounds,
    drawerId: room.drawerId,
    drawerName: room.drawerName,
    wordLength: room.wordLength,
    revealedWord: room.revealedWord,
    hintLetters: room.hintLetters,
    wordOptions: room.wordOptions,
    autoStartAt: room.autoStartAt,
    players: room.players.map(player => [player.id, player.name, player.score, player.guessed]),
    chatTail: room.chat.slice(-8).map(message => [message.id, message.kind, message.text])
  });
}

function applyRoomState(room) {
  const nextRenderKey = roomRenderKey(room);
  state.room = room;
  if (nextRenderKey !== state.renderKey) {
    if (isLocalDrawerDrawing()) {
      state.pendingRenderKey = nextRenderKey;
      return false;
    }
    state.renderKey = nextRenderKey;
    state.pendingRenderKey = "";
    render();
    return true;
  }
  return false;
}

function syncDrawEvents(events = [], forceFullRedraw = false) {
  const canvas = document.querySelector("#board");
  if (!canvas) {
    state.drawEventCursor = events.length;
    state.strokes = replayableStrokes(events);
    return;
  }

  const newEvents = events.slice(state.drawEventCursor);
  const needsFullRedraw = forceFullRedraw ||
    state.drawEventCursor > events.length ||
    newEvents.some(event => event.type === "clear" || event.type === "undo");

  if (needsFullRedraw) {
    state.strokes = replayableStrokes(events);
    state.drawEventCursor = events.length;
    redrawCanvas();
    return;
  }

  for (const event of newEvents) {
    if (event.type !== "stroke" || !event.points?.length) continue;
    state.strokes.push(event);
    if (!isLocalDrawerDrawing()) drawStroke(event);
  }
  state.drawEventCursor = events.length;
}

function persistPlayer(data) {
  state.room = data.room;
  state.renderKey = "";
  state.drawEventCursor = 0;
  state.pendingRenderKey = "";
  state.playerId = data.playerId || state.playerId;
  state.code = data.room.code;
  localStorage.setItem("shakbata:name", state.name);
  localStorage.setItem("shakbata:playerId", state.playerId);
  connect(data.room, state.playerId);
}

function replayableStrokes(events = []) {
  const strokes = [];
  for (const event of events) {
    if (event.type === "clear") strokes.length = 0;
    if (event.type === "undo") {
      for (let index = strokes.length - 1; index >= 0; index -= 1) {
        if (strokes[index].strokeId === event.strokeId) strokes.splice(index, 1);
      }
    }
    if (event.type === "stroke") strokes.push(event);
  }
  return strokes;
}

function render() {
  if (!state.room) return renderHome();
  if (state.room.status === "lobby") return renderLobby();
  if (state.room.status === "ended") return renderEnded();
  return renderGame();
}

function renderHome() {
  const invitedCode = state.code.trim().toUpperCase();
  app.className = "app home-hero";
  app.innerHTML = html`
    <section class="panel">
      <div class="brand-bar">
        <div class="logo"><span class="logo-mark">ش</span> شخبطة</div>
        <span class="pill">موبايل • عربي • بدون تسجيل</span>
      </div>
      <div class="scribble-scene" aria-hidden="true">
        <svg class="home-drawing" viewBox="0 0 360 150" role="img">
          <path class="draw-line sun" d="M286 31 m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0 M286 6 v12 M286 44 v12 M261 31 h12 M299 31 h12 M268 13 l8 8 M296 41 l8 8 M304 13 l-8 8 M276 41 l-8 8" />
          <path class="draw-line house" d="M42 104 L42 72 L78 45 L114 72 L114 104 Z M58 104 L58 82 L76 82 L76 104 M91 87 h13 M46 72 h64" />
          <path class="draw-line cat" d="M168 98 C143 96 130 80 136 61 L127 43 L149 51 C160 43 180 43 191 51 L213 43 L204 61 C210 81 194 98 168 98 Z M151 68 q8 -8 16 0 M181 68 q8 -8 16 0 M174 79 l-5 5 l-5 -5 M166 87 q7 5 14 0 M142 77 h-24 M142 84 h-26 M194 77 h24 M194 84 h26" />
          <path class="draw-line pencil" d="M234 112 L303 80 L315 92 L246 124 Z M303 80 L310 71 L324 85 L315 92 M246 124 L231 129 L234 112" />
          <path class="draw-fill accent-fill" d="M58 104 L58 82 L76 82 L76 104 Z" />
          <path class="draw-fill cat-fill" d="M168 98 C143 96 130 80 136 61 L127 43 L149 51 C160 43 180 43 191 51 L213 43 L204 61 C210 81 194 98 168 98 Z" />
        </svg>
      </div>
      <h1 class="title">${invitedCode ? "ادخل الغرفة" : "ارسمها، وخليهم يخمنوا."}</h1>
      <p class="subtitle">${invitedCode ? `اكتب اسمك وانضم مباشرة لغرفة ${escapeHtml(invitedCode)}.` : "ادخل باسمك، اعمل غرفة بكود، وابدأ جولات رسم وتخمين عربية مع أصحابك."}</p>
      <label class="field">
        <span>اسمك</span>
        <input class="input" data-name maxlength="18" autocomplete="name" placeholder="مثلاً: حودة" value="${escapeHtml(state.name)}" />
      </label>
      <label class="field ${invitedCode ? "hidden-field" : ""}">
        <span>كود الغرفة</span>
        <input class="input" data-code maxlength="5" dir="ltr" placeholder="A7K3Q" value="${escapeHtml(invitedCode)}" />
      </label>
      ${invitedCode ? html`
        <button class="btn" data-join style="width:100%;margin-top:10px">انضمام للغرفة</button>
        <button class="btn ghost" data-cancel-invite style="width:100%;margin-top:10px">اختيار غرفة أخرى</button>
      ` : html`
        <div class="actions">
          <button class="btn" data-create>إنشاء غرفة</button>
          <button class="btn secondary" data-join>انضمام</button>
        </div>
        <button class="btn random-btn" data-quick style="width:100%;margin-top:10px">لعب عشوائي مع ناس</button>
        <button class="btn ghost" data-demo style="width:100%;margin-top:10px">تجربة محلية سريعة</button>
      `}
      <div class="error" data-error></div>
    </section>
  `;
  bindHome();
}

function bindHome() {
  const nameInput = document.querySelector("[data-name]");
  const codeInput = document.querySelector("[data-code]");
  const sync = () => {
    state.name = nameInput.value.trim();
    state.code = codeInput.value.trim().toUpperCase();
  };
  nameInput.addEventListener("input", sync);
  codeInput.addEventListener("input", sync);
  document.querySelector("[data-cancel-invite]")?.addEventListener("click", () => {
    state.code = "";
    clearRoomLink();
    renderHome();
  });
  document.querySelector("[data-create]")?.addEventListener("click", async () => {
    sync();
    try {
      const data = await api("/api/create", { name: state.name });
      persistPlayer(data);
      clearRoomLink();
    } catch (error) {
      setError(error.message);
    }
  });
  document.querySelector("[data-join]")?.addEventListener("click", async () => {
    sync();
    try {
      const data = await api("/api/join", { name: state.name, code: state.code });
      persistPlayer(data);
      clearRoomLink();
    } catch (error) {
      setError(error.message);
    }
  });
  document.querySelector("[data-quick]")?.addEventListener("click", async () => {
    sync();
    try {
      const data = await api("/api/quick-play", { name: state.name });
      persistPlayer(data);
      clearRoomLink();
    } catch (error) {
      setError(error.message);
    }
  });
  document.querySelector("[data-demo]")?.addEventListener("click", async () => {
    sync();
    const firstName = state.name || "لاعب 1";
    try {
      const created = await api("/api/create", { name: firstName, settings: { rounds: 3, drawTime: 60 } });
      persistPlayer(created);
      clearRoomLink();
      await api("/api/join", { name: "لاعب 2", code: created.room.code });
      await api("/api/join", { name: "لاعب 3", code: created.room.code });
    } catch (error) {
      setError(error.message);
    }
  });
}

function renderLobby() {
  const room = state.room;
  const isPublic = room.isPublic;
  const isHost = room.hostId === state.playerId && !isPublic;
  app.className = "app lobby-screen";
  app.innerHTML = html`
    <header class="brand-bar">
      <div class="logo"><span class="logo-mark">ش</span> شخبطة</div>
      <button class="btn ghost" data-leave>خروج</button>
    </header>
    <section class="panel room-header ${isPublic ? "public-room" : ""}">
      <div>
        <div class="small">${isPublic ? "اللعب العشوائي" : "كود الغرفة"}</div>
        <div class="code">${isPublic ? "عام" : room.code}</div>
      </div>
      ${isPublic ? `<span class="matchmaking-dot" title="بحث"></span>` : `<button class="btn secondary" data-share>مشاركة</button>`}
    </section>
    <section class="panel">
      <div class="brand-bar">
        <strong>اللاعبين ${room.players.length}/${room.maxPlayers}</strong>
        <span class="small">${lobbyStatusText(room, isHost)}</span>
      </div>
      <div class="players" style="margin-top:10px">
        ${room.players.map(player => html`
          <div class="player">
            <strong>${escapeHtml(player.name)} ${player.id === room.hostId ? "★" : ""}</strong>
            <span>${player.score}</span>
          </div>
        `).join("")}
      </div>
    </section>
    ${isPublic ? publicLobbyPanel(room) : privateLobbyPanel(room, isHost)}
  `;
  bindLobby();
}

function lobbyStatusText(room, isHost) {
  if (room.isPublic) {
    if (room.players.length < 2) return "في انتظار لاعب عشوائي";
    return room.autoStartAt ? "الماتش بيبدأ حالاً" : "جاهزين";
  }
  return isHost ? "أنت صاحب الغرفة" : "في انتظار البداية";
}

function publicLobbyPanel(room) {
  const waiting = room.players.length < 2;
  return html`
    <section class="panel matchmaking-panel">
      <strong>${waiting ? "بندور على ناس تلعب معاهم" : "لقينا لاعبين"}</strong>
      <div class="matchmaking-pulse" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="small">${waiting ? "سيب الشاشة مفتوحة. أول ما يدخل لاعب تاني الماتش هيبدأ تلقائياً." : "استعد. اختيار الكلمات هيبدأ بعد ثواني."}</p>
      <div class="error" data-error></div>
    </section>
  `;
}

function privateLobbyPanel(room, isHost) {
  return html`
    <section class="panel">
      <div class="settings-grid">
        <label class="field"><span>الجولات</span><select class="select" data-rounds ${isHost ? "" : "disabled"}>${[2,3,4,5,6,8,10].map(v => `<option ${room.totalRounds === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="field"><span>الثواني</span><select class="select" data-time ${isHost ? "" : "disabled"}>${[45,60,70,90,120].map(v => `<option ${room.drawTime === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="field"><span>العدد</span><select class="select" data-max ${isHost ? "" : "disabled"}>${[4,6,8,10,12].map(v => `<option ${room.maxPlayers === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      </div>
      <button class="btn" data-start style="width:100%;margin-top:12px" ${isHost ? "" : "disabled"}>بدء اللعبة</button>
      <div class="error" data-error>${room.players.length < 2 ? "تحتاج لاعبين على الأقل للبدء." : ""}</div>
    </section>
  `;
}

function bindLobby() {
  document.querySelector("[data-leave]").addEventListener("click", leaveRoom);
  document.querySelector("[data-share]")?.addEventListener("click", async () => {
    const link = roomLink(state.room.code);
    const text = `تعالى العب شخبطة معايا!\nكود الغرفة: ${state.room.code}\n${link}`;
    if (navigator.share) await navigator.share({ title: `شخبطة - غرفة ${state.room.code}`, text, url: link });
    else await navigator.clipboard.writeText(text);
  });
  document.querySelector("[data-start]")?.addEventListener("click", async () => {
    try {
      await api("/api/start", { code: state.room.code, playerId: state.playerId });
    } catch (error) {
      setError(error.message);
    }
  });
  for (const selector of ["[data-rounds]", "[data-time]", "[data-max]"]) {
    const element = document.querySelector(selector);
    if (!element || element.disabled) continue;
    element.addEventListener("change", async () => {
      await api("/api/room-settings", {
        code: state.room.code,
        playerId: state.playerId,
        rounds: document.querySelector("[data-rounds]").value,
        drawTime: document.querySelector("[data-time]").value,
        maxPlayers: document.querySelector("[data-max]").value
      });
    });
  }
}

function renderGame() {
  const room = state.room;
  const me = room.players.find(player => player.id === state.playerId);
  const isDrawer = room.drawerId === state.playerId;
  const isChoosing = room.status === "choosing";
  const word = room.revealedWord || "".padStart(room.wordLength, "_");
  const ranking = [...room.players].sort((a, b) => b.score - a.score);
  app.className = "app game-screen";
  app.innerHTML = html`
    <section class="stage">
      <header class="game-header">
        <div class="brand-bar">
          <div>
            <strong>جولة ${room.round}/${room.totalRounds}</strong>
            <div class="small">${isChoosing ? (isDrawer ? "اختار كلمة للرسم" : `${escapeHtml(room.drawerName)} بيختار كلمة`) : (isDrawer ? "دورك ترسم الكلمة" : `الرسام: ${escapeHtml(room.drawerName)}`)}</div>
          </div>
          <span class="pill">نقاطك: ${me?.score || 0}</span>
        </div>
        <div class="timer" data-timer>--</div>
      </header>
      <div class="score-list">
        ${ranking.slice(0, 3).map(player => html`
          <span class="score-chip ${player.id === room.drawerId ? "drawer-chip" : ""}" title="${escapeHtml(player.name)}">${escapeHtml(compactName(player.name))} · ${player.score}</span>
        `).join("")}
        ${ranking.length > 3 ? `<span class="score-chip">+${ranking.length - 3}</span>` : ""}
      </div>
      <div class="word-row panel">
        <div class="word">
          ${wordDisplay(room, isDrawer, isChoosing, word)}
        </div>
        <span class="small">${isChoosing ? "اختيار" : (room.status === "reveal" ? "الكلمة" : `${room.wordLength} حروف`)}</span>
      </div>
      ${isChoosing ? `<div class="tools panel round-note">${isDrawer ? "اختار بسرعة. لو الوقت خلص هنختار أول كلمة." : "استعدوا للتخمين..."}</div>` : drawToolsHtml()}
      <div class="canvas-wrap">
        ${isChoosing ? chooseBoardHtml(room, isDrawer) : `<canvas id="board"></canvas>${isDrawer && room.status === "playing" ? "" : `<div class="canvas-lock">${room.status === "reveal" ? "استراحة قصيرة قبل الجولة التالية" : "أنت بتخمن من الدردشة"}</div>`}`}
      </div>
      <section class="panel chat-panel">
        <div class="chat" data-chat>
          ${room.chat.map(message => messageHtml(message)).join("")}
        </div>
        <form class="guess-form" data-guess-form>
          <input class="input" data-guess placeholder="${guessPlaceholder(isDrawer, isChoosing)}" ${isDrawer ? "disabled" : ""} maxlength="80" />
          <button class="btn" ${isDrawer ? "disabled" : ""}>↵</button>
        </form>
      </section>
    </section>
  `;
  bindGame();
}

function wordDisplay(room, isDrawer, isChoosing, word) {
  if (isChoosing) return isDrawer ? "اختار كلمة للرسم" : "في انتظار اختيار الكلمة";
  if (isDrawer || room.revealedWord) return escapeHtml(room.revealedWord);
  const hints = new Map((room.hintLetters || []).map(hint => [hint.index, hint.letter]));
  return Array.from(word).map((_, index) => {
    const letter = hints.get(index);
    return `<span class="letter ${letter ? "hinted" : ""}">${letter ? escapeHtml(letter) : ""}</span>`;
  }).join("");
}

function drawToolsHtml() {
  return html`
    <div class="tools panel">
      <button class="icon-btn ${state.tool === "pen" ? "active" : ""}" data-tool="pen" title="قلم">✎</button>
      <button class="icon-btn ${state.tool === "eraser" ? "active" : ""}" data-tool="eraser" title="ممحاة">⌫</button>
      <label class="color-picker" style="--picked-color:${state.color}" title="لون القلم"><input data-color-picker type="color" value="${state.color}" /></label>
      <input class="size" data-size type="range" min="2" max="26" value="${state.size}" title="حجم القلم" />
      <button class="icon-btn" data-undo title="تراجع">↶</button>
      <button class="icon-btn" data-clear title="مسح">×</button>
    </div>
  `;
}

function chooseBoardHtml(room, isDrawer) {
  if (!isDrawer) {
    return html`
      <div class="choice-board waiting-board">
        <strong>${escapeHtml(room.drawerName)} بيختار كلمة</strong>
        <span>أول ما يختار، الجولة تبدأ والوقت يتحسب.</span>
      </div>
    `;
  }

  return html`
    <div class="choice-board">
      <strong>اختار واحدة ترسمها</strong>
      <div class="word-options">
        ${room.wordOptions.map(word => `<button class="word-option" data-word-choice="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join("")}
      </div>
    </div>
  `;
}

function guessPlaceholder(isDrawer, isChoosing) {
  if (isDrawer) return isChoosing ? "اختار كلمة الأول" : "أنت الرسام في الجولة دي";
  return isChoosing ? "استنى اختيار الكلمة" : "اكتب تخمينك";
}

function messageHtml(message) {
  if (message.kind === "system") return `<div class="message system">${escapeHtml(message.text)}</div>`;
  if (message.kind === "correct") return `<div class="message correct">${escapeHtml(message.text)}</div>`;
  return `<div class="message"><strong>${escapeHtml(message.name)}:</strong> ${escapeHtml(message.text)}</div>`;
}

function bindGame() {
  const chat = document.querySelector("[data-chat]");
  if (chat) chat.scrollTop = chat.scrollHeight;
  document.querySelector("[data-guess-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.querySelector("[data-guess]");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await api("/api/guess", { code: state.room.code, playerId: state.playerId, text });
  });
  document.querySelectorAll("[data-tool]").forEach(button => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      render();
    });
  });
  document.querySelectorAll("[data-word-choice]").forEach(button => {
    button.addEventListener("click", async () => {
      await api("/api/choose-word", { code: state.room.code, playerId: state.playerId, word: button.dataset.wordChoice });
    });
  });
  document.querySelector("[data-color-picker]")?.addEventListener("input", event => {
    state.color = event.target.value;
    state.tool = "pen";
    const picker = document.querySelector(".color-picker");
    if (picker) picker.style.setProperty("--picked-color", state.color);
  });
  document.querySelector("[data-size]")?.addEventListener("input", event => {
    state.size = Number(event.target.value);
  });
  document.querySelector("[data-undo]")?.addEventListener("click", () => {
    const lastStroke = state.strokes[state.strokes.length - 1];
    if (lastStroke) sendDraw({ type: "undo", strokeId: lastStroke.strokeId });
  });
  document.querySelector("[data-clear]")?.addEventListener("click", () => sendDraw({ type: "clear" }));
  setupCanvas();
  tickTimer();
}

function renderEnded() {
  const ranking = [...state.room.players].sort((a, b) => b.score - a.score);
  app.className = "app end-screen";
  app.innerHTML = html`
    <header class="brand-bar">
      <div class="logo"><span class="logo-mark">ش</span> شخبطة</div>
      <button class="btn ghost" data-leave>خروج</button>
    </header>
    <section class="panel">
      <h1 class="title">النتيجة النهائية</h1>
      <div class="ended-list">
        ${ranking.map(player => `<div class="rank"><strong>${escapeHtml(player.name)}</strong><span>${player.score} نقطة</span></div>`).join("")}
      </div>
      <button class="btn" data-share style="width:100%;margin-top:12px">مشاركة النتيجة</button>
    </section>
  `;
  document.querySelector("[data-leave]").addEventListener("click", leaveRoom);
  document.querySelector("[data-share]").addEventListener("click", async () => {
    const text = `نتيجة شخبطة:\n${ranking.map((p, i) => `${i + 1}. ${p.name}: ${p.score}`).join("\n")}`;
    if (navigator.share) await navigator.share({ text });
    else await navigator.clipboard.writeText(text);
  });
}

function leaveRoom() {
  if (state.source) state.source.close();
  state.room = null;
  state.code = "";
  state.renderKey = "";
  state.drawEventCursor = 0;
  state.pendingRenderKey = "";
  localStorage.removeItem("shakbata:playerId");
  renderHome();
}

function setupCanvas() {
  const canvas = document.querySelector("#board");
  if (!canvas) return;
  const parent = canvas.parentElement;
  const rect = parent.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  redrawCanvas();
  const isDrawer = state.room.drawerId === state.playerId && state.room.status === "playing";
  if (!isDrawer) return;
  canvas.addEventListener("pointerdown", startStroke);
  canvas.addEventListener("pointermove", moveStroke);
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
}

function pointFromEvent(event) {
  const canvas = document.querySelector("#board");
  const rect = canvas.getBoundingClientRect();
  return {
    x: Number(((event.clientX - rect.left) / rect.width).toFixed(4)),
    y: Number(((event.clientY - rect.top) / rect.height).toFixed(4))
  };
}

function startStroke(event) {
  event.preventDefault();
  state.isDrawing = true;
  state.strokeId = crypto.randomUUID();
  state.pendingPoints = [pointFromEvent(event)];
}

function moveStroke(event) {
  if (!state.isDrawing) return;
  event.preventDefault();
  state.pendingPoints.push(pointFromEvent(event));
  drawStroke({ points: state.pendingPoints.slice(-2), color: activeColor(), size: state.size, tool: state.tool });
  const now = Date.now();
  if (now - state.lastSentAt > 55 && state.pendingPoints.length > 1) flushStroke(false);
}

function endStroke() {
  if (!state.isDrawing) return;
  state.isDrawing = false;
  flushStroke(true);
  if (state.pendingRenderKey) {
    state.renderKey = state.pendingRenderKey;
    state.pendingRenderKey = "";
    render();
    syncDrawEvents(state.room?.drawEvents || [], true);
  }
}

function activeColor() {
  return state.tool === "eraser" ? "#ffffff" : state.color;
}

function flushStroke(force) {
  if (!force && state.pendingPoints.length < 2) return;
  sendDraw({
    type: "stroke",
    strokeId: state.strokeId,
    points: state.pendingPoints,
    color: activeColor(),
    size: state.size,
    tool: state.tool
  });
  state.pendingPoints = state.pendingPoints.slice(-1);
  state.lastSentAt = Date.now();
}

async function sendDraw(event) {
  await api("/api/draw", { code: state.room.code, playerId: state.playerId, event });
}

function redrawCanvas() {
  const canvas = document.querySelector("#board");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  for (const stroke of state.strokes) drawStroke(stroke);
}

function drawStroke(stroke) {
  const canvas = document.querySelector("#board");
  if (!canvas || !stroke.points?.length) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.beginPath();
  stroke.points.forEach((point, index) => {
    const x = point.x * rect.width;
    const y = point.y * rect.height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function tickTimer() {
  const timer = document.querySelector("[data-timer]");
  if (!timer || !state.room?.endsAt) return;
  const left = Math.max(0, Math.ceil((state.room.endsAt - Date.now()) / 1000));
  timer.textContent = left;
  timer.classList.toggle("low", left <= 10);
  setTimeout(tickTimer, 350);
}

renderHome();
