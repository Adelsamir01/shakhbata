const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");
const rooms = new Map();

const words = [
  "قطة", "كلب", "أسد", "فيل", "سمكة", "عصفور", "حصان", "جمل", "أرنب", "سلحفاة",
  "زرافة", "نمر", "دب", "ثعلب", "ذئب", "قرد", "غزال", "تمساح", "بطريق", "كنغر",
  "بطة", "دجاجة", "ديك", "بقرة", "خروف", "ماعز", "حمار", "فأر", "خفاش", "نحلة",
  "فراشة", "نملة", "عنكبوت", "أخطبوط", "دلفين", "قرش", "حوت", "ضفدع", "بومة", "نسر",
  "حمامة", "ببغاء", "طاووس", "قنفذ", "حلزون", "سرطان", "حصان بحر", "كوالا", "باندا", "راكون",
  "بيت", "كرسي", "طاولة", "باب", "شباك", "سرير", "مصباح", "ساعة", "هاتف", "كتاب",
  "مفتاح", "شنطة", "حذاء", "قلم", "دفتر", "كوب", "طبق", "شوكة", "ملعقة", "سكين",
  "ثلاجة", "غسالة", "فرن", "مروحة", "تلفزيون", "ريموت", "مرآة", "مشط", "فرشاة", "صابون",
  "منشفة", "مخدة", "بطانية", "سجادة", "ستارة", "خزانة", "درج", "سلم", "مصعد", "جرس",
  "شمعة", "كاميرا", "سماعة", "كمبيوتر", "لابتوب", "شاحن", "بطارية", "مظلة", "خيمة", "خريطة",
  "بيتزا", "كشري", "فول", "كنافة", "شاورما", "عصير", "تفاحة", "موز", "قهوة", "آيس كريم",
  "برجر", "بطاطس", "مكرونة", "أرز", "دجاج", "سمك", "بيض", "جبنة", "خبز", "فطير",
  "محشي", "ملوخية", "فتة", "طعمية", "حمص", "تبولة", "ورق عنب", "كبسة", "مندي", "مقلوبة",
  "منسف", "مسقعة", "شوربة", "سلطة", "بطيخ", "عنب", "برتقال", "فراولة", "مانجو", "أناناس",
  "ليمون", "خيار", "طماطم", "جزر", "بصل", "فلفل", "ذرة", "فشار", "شوكولاتة", "بسكويت",
  "كيك", "دونات", "عسل", "لبن", "شاي", "ماء", "تمر", "لوز", "فستق", "زبادي",
  "طبيب", "مهندس", "مدرس", "شرطي", "طباخ", "لاعب", "رسام", "طيار", "مصور", "مذيع",
  "ممرض", "محامي", "قاضي", "نجار", "حداد", "كهربائي", "سباك", "بائع", "خباز", "حلاق",
  "مزارع", "صياد", "بحار", "سائق", "مغني", "ممثل", "كاتب", "صحفي", "مترجم", "مبرمج",
  "مصمم", "حارس", "رجل إطفاء", "رائد فضاء", "عالم", "طبيب أسنان", "صيدلي", "مدرب", "حكم", "مخرج",
  "بحر", "مدرسة", "حديقة", "مطار", "سينما", "مسجد", "مكتبة", "مستشفى", "ملعب", "سوق",
  "مطعم", "مقهى", "فندق", "بنك", "متحف", "جامعة", "مزرعة", "ميناء", "محطة", "جزيرة",
  "صحراء", "غابة", "كهف", "شاطئ", "نهر", "بحيرة", "جسر", "برج", "قلعة", "قصر",
  "ملاهي", "حديقة حيوان", "مكتب", "مصنع", "مخبز", "صيدلية", "بقالة", "ورشة", "مسرح", "استاد",
  "كرة", "سيارة", "قطار", "قارب", "شمس", "قمر", "نجمة", "مطر", "جبل", "نظارة"
  , "دراجة", "دراجة نارية", "طائرة", "حافلة", "تاكسي", "مترو", "سفينة", "غواصة", "صاروخ", "إسعاف",
  "عربة", "إشارة مرور", "طريق", "نفق", "رصيف", "عجلة", "خوذة", "حزام", "بنزين", "بوصلة",
  "كرة قدم", "كرة سلة", "تنس", "سباحة", "جري", "ملاكمة", "مصارعة", "تزلج", "غوص", "رماية",
  "شطرنج", "طاولة زهر", "بلياردو", "كاراتيه", "يوجا", "مضرب", "شبكة", "كأس", "ميدالية", "صافرة",
  "سحابة", "برق", "رعد", "ثلج", "رياح", "وردة", "شجرة", "نخلة", "صبار", "عشب",
  "بركان", "قوس قزح", "كوكب", "فضاء", "سفينة فضاء", "مجرة", "نار", "دخان", "حجر", "رمل",
  "قميص", "بنطلون", "فستان", "قبعة", "جاكيت", "جورب", "قفاز", "خاتم", "ساعة يد", "سلسلة",
  "فرعون", "مومياء", "هرم", "أبو الهول", "فانوس", "طبلة", "عود", "مزمار", "رقصة", "ميكروفون",
  "روبوت", "واي فاي", "رسالة", "إيميل", "لعبة", "كنترول", "سماعات", "ماوس", "كيبورد", "طابعة",
  "مغناطيس", "تلسكوب", "مجهر", "دواء", "حقنة", "ضمادة", "ميزان", "كيس", "صندوق", "هدية",
  "بالون", "طائرة ورق", "عجلة ملاهي", "زحليقة", "مرجيحة", "دمية", "دبدوب", "لغز", "قناع", "تاج",
  "كنبة", "بلكونة", "حمام", "مطبخ", "صالون", "غرفة", "سطح", "حوش", "بوابة", "جراج",
  "زحمة", "كوبري", "كشك", "توك توك", "ميكروباص", "موبايل", "فلوس", "عملة", "محفظة", "فاتورة",
  "مدرسة", "سبورة", "طباشير", "مسطرة", "ممحاة", "حقيبة مدرسية", "امتحان", "جرس المدرسة", "معمل", "فسحة",
  "ساحر", "وحش", "تنين", "كنز", "خريطة كنز", "سيف", "درع", "سهم", "قلعة رمل", "مصباح سحري",
  "كابتن", "قرصان", "غواص", "ملك", "ملكة", "أمير", "أميرة", "جندي", "شرطي مرور", "لص",
  "حلاق", "عريس", "عروسة", "طفل", "جد", "جدة", "عائلة", "صديق", "جار", "ضيف"
];

const blockedWords = ["غبي", "وسخ", "زبالة"];

function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(code) ? roomCode() : code;
}

function normalizeText(value = "") {
  return String(value)
    .trim()
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function cleanName(name) {
  const cleaned = String(name || "").trim().slice(0, 18);
  if (!cleaned || blockedWords.some(word => normalizeText(cleaned).includes(normalizeText(word)))) {
    return null;
  }
  return cleaned;
}

function publicRoom(room, viewerId = "") {
  const currentWord = room.word || "";
  const canSeeWord = room.status === "reveal" || room.status === "ended" || viewerId === room.drawerId;
  const canChooseWord = room.status === "choosing" && viewerId === room.drawerId;
  const canSeeHints = room.status === "playing" && viewerId !== room.drawerId;
  return {
    code: room.code,
    isPublic: room.isPublic,
    hostId: room.hostId,
    status: room.status,
    round: room.round,
    totalRounds: room.settings.rounds,
    drawTime: room.settings.drawTime,
    maxPlayers: room.settings.maxPlayers,
    drawerId: room.drawerId,
    drawerName: room.players.find(player => player.id === room.drawerId)?.name || "",
    wordLength: currentWord.length,
    revealedWord: canSeeWord ? currentWord : "",
    hintLetters: canSeeHints ? visibleHintLetters(room) : [],
    wordOptions: canChooseWord ? room.wordOptions : [],
    endsAt: room.endsAt,
    autoStartAt: room.autoStartAt,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      score: player.score,
      guessed: player.guessed,
      muted: player.muted
    })),
    chat: room.chat.slice(-80),
    drawEvents: room.drawEvents.slice(-600),
    lastWinner: room.lastWinner
  };
}

function broadcast(room) {
  for (const client of room.clients) {
    const payload = `data: ${JSON.stringify({ type: "state", room: publicRoom(room, client.playerId) })}\n\n`;
    client.write(payload);
  }
}

function addChat(room, entry) {
  room.chat.push({ id: crypto.randomUUID(), at: Date.now(), ...entry });
  if (room.chat.length > 120) room.chat.splice(0, room.chat.length - 120);
}

function addPlayer(room, name) {
  const player = { id: crypto.randomUUID(), name, score: 0, guessed: false, muted: false };
  room.players.push(player);
  addChat(room, { kind: "system", text: `${name} دخل الغرفة.` });
  return player;
}

function pickWord() {
  return words[Math.floor(Math.random() * words.length)];
}

function pickWordOptions(count = 3) {
  const options = new Set();
  while (options.size < count && options.size < words.length) options.add(pickWord());
  return [...options];
}

function pickHintIndexes(word) {
  const indexes = [...word].map((letter, index) => ({ letter, index }))
    .filter(item => item.letter.trim());
  indexes.sort(() => Math.random() - 0.5);
  return indexes.slice(0, Math.min(2, indexes.length)).map(item => item.index);
}

function visibleHintLetters(room) {
  const elapsed = Date.now() - room.startedAt;
  const firstHintAt = room.settings.drawTime * 1000 * 0.35;
  const secondHintAt = room.settings.drawTime * 1000 * 0.65;
  const count = elapsed >= secondHintAt ? 2 : elapsed >= firstHintAt ? 1 : 0;
  return room.hintIndexes.slice(0, count).map(index => ({ index, letter: room.word[index] }));
}

function clearHintTimers(room) {
  for (const timer of room.hintTimers) clearTimeout(timer);
  room.hintTimers = [];
}

function scheduleHintTimers(room) {
  clearHintTimers(room);
  const delays = [
    Math.round(room.settings.drawTime * 1000 * 0.35),
    Math.round(room.settings.drawTime * 1000 * 0.65)
  ];
  for (const delay of delays) {
    room.hintTimers.push(setTimeout(() => {
      if (room.status === "playing") broadcast(room);
    }, delay));
  }
}

function nextDrawer(room) {
  if (!room.players.length) return null;
  const nextIndex = room.drawerIndex % room.players.length;
  room.drawerIndex += 1;
  return room.players[nextIndex].id;
}

function startRound(room) {
  if (room.round >= room.settings.rounds) {
    room.status = "ended";
    room.revealTimer = null;
    room.lastWinner = null;
    addChat(room, { kind: "system", text: "انتهت اللعبة! شوفوا الترتيب النهائي." });
    broadcast(room);
    return;
  }

  room.status = "choosing";
  room.round += 1;
  room.word = "";
  room.wordOptions = pickWordOptions(3);
  room.hintIndexes = [];
  clearHintTimers(room);
  room.drawerId = nextDrawer(room);
  room.endsAt = Date.now() + 12000;
  room.drawEvents = [];
  room.lastWinner = null;
  for (const player of room.players) player.guessed = false;
  addChat(room, { kind: "system", text: `الجولة ${room.round}. ${room.players.find(player => player.id === room.drawerId)?.name} بيختار كلمة.` });
  clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => chooseWord(room, room.wordOptions[0]), 12000);
  broadcast(room);
}

function chooseWord(room, word) {
  if (room.status !== "choosing") return;
  const selected = room.wordOptions.includes(word) ? word : room.wordOptions[0];
  room.status = "playing";
  room.word = selected;
  room.wordOptions = [];
  room.hintIndexes = pickHintIndexes(selected);
  room.startedAt = Date.now();
  room.endsAt = Date.now() + room.settings.drawTime * 1000;
  clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => revealRound(room, "انتهى الوقت!"), room.settings.drawTime * 1000);
  scheduleHintTimers(room);
  addChat(room, { kind: "system", text: `بدأ الرسم! الرسام: ${room.players.find(player => player.id === room.drawerId)?.name}` });
  broadcast(room);
}

function revealRound(room, text) {
  if (room.status !== "playing") return;
  room.status = "reveal";
  room.endsAt = Date.now() + 5000;
  clearHintTimers(room);
  addChat(room, { kind: "system", text: `${text} الكلمة كانت: ${room.word}` });
  clearTimeout(room.roundTimer);
  clearTimeout(room.revealTimer);
  room.revealTimer = setTimeout(() => startRound(room), 5000);
  broadcast(room);
}

function createRoom(hostName, settings = {}, options = {}) {
  const player = { id: crypto.randomUUID(), name: hostName, score: 0, guessed: false, muted: false };
  const room = {
    code: roomCode(),
    isPublic: Boolean(options.isPublic),
    hostId: player.id,
    players: [player],
    clients: new Set(),
    status: "lobby",
    settings: {
      rounds: Math.max(2, Math.min(10, Number(settings.rounds) || 4)),
      drawTime: Math.max(35, Math.min(120, Number(settings.drawTime) || 70)),
      maxPlayers: Math.max(2, Math.min(12, Number(settings.maxPlayers) || 8))
    },
    round: 0,
    drawerIndex: 0,
    drawerId: null,
    word: "",
    wordOptions: [],
    hintIndexes: [],
    hintTimers: [],
    startedAt: 0,
    endsAt: null,
    chat: [],
    drawEvents: [],
    lastWinner: null,
    roundTimer: null,
    revealTimer: null,
    autoStartTimer: null,
    autoStartAt: null
  };
  addChat(room, { kind: "system", text: options.isPublic ? `${hostName} دخل اللعب العشوائي.` : `${hostName} أنشأ الغرفة.` });
  rooms.set(room.code, room);
  return { room, player };
}

function findPublicLobby() {
  return [...rooms.values()]
    .filter(room => room.isPublic && room.status === "lobby" && room.players.length < room.settings.maxPlayers)
    .sort((a, b) => b.players.length - a.players.length)[0];
}

function schedulePublicStart(room) {
  if (!room.isPublic || room.status !== "lobby" || room.players.length < 2 || room.autoStartTimer) return;
  room.autoStartAt = Date.now() + 5000;
  addChat(room, { kind: "system", text: "الماتش هيبدأ خلال 5 ثواني." });
  room.autoStartTimer = setTimeout(() => {
    room.autoStartTimer = null;
    room.autoStartAt = null;
    if (room.status === "lobby" && room.players.length >= 2) {
      room.round = 0;
      room.drawerIndex = 0;
      for (const player of room.players) player.score = 0;
      startRound(room);
    } else {
      broadcast(room);
    }
  }, 5000);
  broadcast(room);
}

function getRoom(code) {
  return rooms.get(String(code || "").trim().toUpperCase());
}

function getPlayer(room, playerId) {
  return room.players.find(player => player.id === playerId);
}

function staticFile(req, res) {
  const requestedPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const filePath = requestedPath === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, requestedPath);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: "Forbidden" });
  fs.readFile(filePath, (error, content) => {
    if (error) return sendJson(res, 404, { error: "Not found" });
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".webmanifest": "application/manifest+json" };
    res.writeHead(200, { "content-type": `${types[ext] || "application/octet-stream"}; charset=utf-8` });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/events") {
    const room = getRoom(url.searchParams.get("room"));
    const playerId = url.searchParams.get("player");
    if (!room || !getPlayer(room, playerId)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    res.playerId = playerId;
    room.clients.add(res);
    res.write(`data: ${JSON.stringify({ type: "state", room: publicRoom(room, playerId) })}\n\n`);
    req.on("close", () => room.clients.delete(res));
    return;
  }

  if (!url.pathname.startsWith("/api/")) return staticFile(req, res);

  try {
    if (req.method === "POST" && url.pathname === "/api/create") {
      const body = await readBody(req);
      const name = cleanName(body.name);
      if (!name) return sendJson(res, 400, { error: "اكتب اسم مناسب." });
      const { room, player } = createRoom(name, body.settings);
      return sendJson(res, 200, { room: publicRoom(room, player.id), playerId: player.id });
    }

    if (req.method === "POST" && url.pathname === "/api/join") {
      const body = await readBody(req);
      const name = cleanName(body.name);
      const room = getRoom(body.code);
      if (!name) return sendJson(res, 400, { error: "اكتب اسم مناسب." });
      if (!room) return sendJson(res, 404, { error: "الغرفة غير موجودة." });
      if (room.players.length >= room.settings.maxPlayers) return sendJson(res, 409, { error: "الغرفة ممتلئة." });
      if (room.status !== "lobby") return sendJson(res, 409, { error: "اللعبة بدأت بالفعل." });
      const player = addPlayer(room, name);
      broadcast(room);
      return sendJson(res, 200, { room: publicRoom(room, player.id), playerId: player.id });
    }

    if (req.method === "POST" && url.pathname === "/api/quick-play") {
      const body = await readBody(req);
      const name = cleanName(body.name);
      if (!name) return sendJson(res, 400, { error: "اكتب اسم مناسب." });

      let room = findPublicLobby();
      let player;
      if (room) {
        player = addPlayer(room, name);
      } else {
        const created = createRoom(name, { rounds: 3, drawTime: 60, maxPlayers: 8 }, { isPublic: true });
        room = created.room;
        player = created.player;
      }

      schedulePublicStart(room);
      broadcast(room);
      return sendJson(res, 200, { room: publicRoom(room, player.id), playerId: player.id });
    }

    if (req.method === "POST" && url.pathname === "/api/start") {
      const body = await readBody(req);
      const room = getRoom(body.code);
      if (!room || room.hostId !== body.playerId) return sendJson(res, 403, { error: "لا يمكنك بدء هذه الغرفة." });
      if (room.players.length < 2) return sendJson(res, 400, { error: "تحتاج لاعبين على الأقل." });
      room.round = 0;
      room.drawerIndex = 0;
      for (const player of room.players) player.score = 0;
      startRound(room);
      return sendJson(res, 200, { room: publicRoom(room, body.playerId) });
    }

    if (req.method === "POST" && url.pathname === "/api/guess") {
      const body = await readBody(req);
      const room = getRoom(body.code);
      if (!room) return sendJson(res, 404, { error: "الغرفة غير موجودة." });
      const player = getPlayer(room, body.playerId);
      if (!player || player.muted) return sendJson(res, 403, { error: "لا يمكنك الإرسال." });
      const text = String(body.text || "").trim().slice(0, 80);
      if (!text) return sendJson(res, 400, { error: "اكتب تخمين." });
      if (blockedWords.some(word => normalizeText(text).includes(normalizeText(word)))) {
        addChat(room, { kind: "system", text: "تم حجب رسالة غير مناسبة." });
        broadcast(room);
        return sendJson(res, 200, { ok: true });
      }
      if (room.status !== "playing" || player.id === room.drawerId || player.guessed) {
        addChat(room, { kind: "message", playerId: player.id, name: player.name, text });
        broadcast(room);
        return sendJson(res, 200, { ok: true });
      }
      if (normalizeText(text) === normalizeText(room.word)) {
        const remaining = Math.max(0, room.endsAt - Date.now());
        const base = Math.round(30 + (remaining / (room.settings.drawTime * 1000)) * 70);
        player.score += base;
        player.guessed = true;
        const drawer = getPlayer(room, room.drawerId);
        if (drawer) drawer.score += 20;
        room.lastWinner ||= player.name;
        addChat(room, { kind: "correct", playerId: player.id, name: player.name, text: `${player.name} خمّن الكلمة! +${base}` });
        const activeGuessers = room.players.filter(p => p.id !== room.drawerId);
        if (activeGuessers.every(p => p.guessed)) revealRound(room, "كل اللاعبين خمنوا!");
        else broadcast(room);
        return sendJson(res, 200, { correct: true });
      }
      addChat(room, { kind: "message", playerId: player.id, name: player.name, text });
      broadcast(room);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/choose-word") {
      const body = await readBody(req);
      const room = getRoom(body.code);
      if (!room || room.status !== "choosing" || room.drawerId !== body.playerId) {
        return sendJson(res, 403, { error: "اختيار الكلمة للرسام فقط." });
      }
      chooseWord(room, String(body.word || ""));
      return sendJson(res, 200, { room: publicRoom(room, body.playerId) });
    }

    if (req.method === "POST" && url.pathname === "/api/draw") {
      const body = await readBody(req);
      const room = getRoom(body.code);
      if (!room || room.status !== "playing" || room.drawerId !== body.playerId) return sendJson(res, 403, { error: "الرسم للرسام فقط." });
      const event = body.event || {};
      const safeEvent = {
        type: ["stroke", "clear", "undo"].includes(event.type) ? event.type : "stroke",
        points: Array.isArray(event.points) ? event.points.slice(0, 80) : [],
        color: String(event.color || "#111827").slice(0, 16),
        size: Math.max(2, Math.min(34, Number(event.size) || 6)),
        tool: event.tool === "eraser" ? "eraser" : "pen",
        strokeId: String(event.strokeId || crypto.randomUUID()).slice(0, 80)
      };
      if (safeEvent.type === "clear") room.drawEvents = [safeEvent];
      else if (safeEvent.type === "undo") room.drawEvents.push(safeEvent);
      else if (safeEvent.points.length) room.drawEvents.push(safeEvent);
      if (room.drawEvents.length > 700) room.drawEvents.splice(0, room.drawEvents.length - 700);
      broadcast(room);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/room-settings") {
      const body = await readBody(req);
      const room = getRoom(body.code);
      if (!room || room.hostId !== body.playerId || room.status !== "lobby") return sendJson(res, 403, { error: "الإعدادات لصاحب الغرفة فقط." });
      room.settings.rounds = Math.max(2, Math.min(10, Number(body.rounds) || room.settings.rounds));
      room.settings.drawTime = Math.max(35, Math.min(120, Number(body.drawTime) || room.settings.drawTime));
      room.settings.maxPlayers = Math.max(2, Math.min(12, Number(body.maxPlayers) || room.settings.maxPlayers));
      broadcast(room);
      return sendJson(res, 200, { room: publicRoom(room, body.playerId) });
    }
  } catch (error) {
    return sendJson(res, 500, { error: "حدث خطأ في السيرفر." });
  }

  sendJson(res, 404, { error: "Not found" });
});

server.on("error", error => {
  console.error(`Could not start server on ${HOST}:${PORT} (${error.code || error.message}).`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Arabic Scribble running on http://${HOST}:${PORT}`);
});
