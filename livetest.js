const WebSocket = require('ws');
const BASE = 'https://shakhbata.adelsamir.com';

async function api(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${data.error || 'HTTP error'} (${res.status})`);
  return data;
}

function connectWS(code, playerId, name = 'player') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://shakhbata.adelsamir.com/ws?room=${code}&player=${playerId}`);
    const messages = [];
    let gotState = false;
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', room: code, player: playerId })));
    ws.on('message', d => { const m = JSON.parse(d); messages.push(m); if (m.type === 'state') gotState = true; });
    ws.on('error', e => reject(new Error(`${name} WS error: ${e.message}`)));
    ws.on('close', (c, r) => { if (!gotState) reject(new Error(`${name} WS closed before state: ${c} ${r}`)); });
    setTimeout(() => reject(new Error(`${name} WS timeout`)), 10000);
    ws.waitForState = () => new Promise(r => {
      const check = () => {
        const msg = messages.slice(-1).find(m => m.type === 'state');
        if (msg) r(msg.room); else setTimeout(check, 100);
      };
      check();
    });
    ws.getMessages = () => messages;
    ws.sendJSON = obj => ws.send(JSON.stringify(obj));
    resolve(ws);
  });
}

function assert(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); }

(async () => {
  const dev = 'dev-' + Date.now();

  console.log('TEST 1: Create private room');
  const create = await api('/api/create', { name: 'Host', settings: { rounds: 2, drawTime: 30, maxPlayers: 6 }, deviceId: dev + '-host' });
  assert(create.room.hostId === create.playerId, 'host should be creator');
  assert(create.room.status === 'lobby', 'room in lobby');
  console.log('  OK', create.room.code);

  console.log('TEST 2: Host WebSocket');
  const hostWs = await connectWS(create.room.code, create.playerId, 'host');
  let state = await hostWs.waitForState();
  assert(state.players.length === 1, 'host is only player');
  console.log('  OK');

  console.log('TEST 3: Guest joins private room');
  const join = await api('/api/join', { name: 'Guest', code: create.room.code, deviceId: dev + '-guest' });
  assert(join.playerId !== create.playerId, 'guest gets new id');
  console.log('  OK', join.playerId);

  console.log('TEST 4: Guest WebSocket');
  const guestWs = await connectWS(create.room.code, join.playerId, 'guest');
  state = await guestWs.waitForState();
  assert(state.players.length === 2, 'two players');
  console.log('  OK');

  console.log('TEST 5: Room settings');
  hostWs.sendJSON({ type: 'room-settings', rounds: 2, drawTime: 45, maxPlayers: 8 });
  await new Promise(r => setTimeout(r, 300));
  state = await hostWs.waitForState();
  assert(state.totalRounds === 2, 'rounds updated');
  assert(state.drawTime === 45, 'draw time updated');
  assert(state.maxPlayers === 8, 'max players updated');
  console.log('  OK');

  console.log('TEST 6: Start game');
  hostWs.sendJSON({ type: 'start' });
  await new Promise(r => setTimeout(r, 500));
  state = await hostWs.waitForState();
  assert(state.status === 'choosing', 'game in choosing');
  assert(state.drawerId === create.playerId, 'host is drawer');
  assert(state.wordOptions.length === 3, 'word options shown');
  console.log('  OK', state.status);

  console.log('TEST 7: Choose word');
  const word = state.wordOptions[1];
  hostWs.sendJSON({ type: 'choose-word', word });
  await new Promise(r => setTimeout(r, 500));
  state = await hostWs.waitForState();
  assert(state.status === 'playing', 'game playing');
  assert(state.wordLength > 0, 'word length set');
  console.log('  OK word length', state.wordLength);

  console.log('TEST 8: Draw stroke');
  hostWs.sendJSON({ type: 'draw', event: { type: 'stroke', strokeId: 's1', points: [{x:0.1,y:0.1},{x:0.2,y:0.2}], color: '#111827', size: 5, tool: 'pen' } });
  await new Promise(r => setTimeout(r, 500));
  const guestDraws = guestWs.getMessages().filter(m => m.type === 'draw');
  assert(guestDraws.length === 1, 'guest received draw');
  assert(guestDraws[0].seq === 1, 'draw seq 1');
  console.log('  OK');

  console.log('TEST 9: Correct guess');
  guestWs.sendJSON({ type: 'guess', text: word });
  await new Promise(r => setTimeout(r, 500));
  state = await guestWs.waitForState();
  assert(state.status === 'reveal', 'round revealed');
  const guestScore = state.players.find(p => p.id === join.playerId)?.score;
  const hostScore = state.players.find(p => p.id === create.playerId)?.score;
  assert(guestScore > 0, 'guest scored');
  assert(hostScore > 0, 'drawer scored');
  console.log('  OK guest', guestScore, 'host', hostScore);

  console.log('TEST 10: Next round starts');
  await new Promise(r => setTimeout(r, 5500));
  state = await guestWs.waitForState();
  assert(state.status === 'choosing', 'next round choosing');
  assert(state.round === 2, 'round 2');
  console.log('  OK round', state.round);

  console.log('TEST 11: Guest drawer chooses');
  const word2 = state.wordOptions[0];
  guestWs.sendJSON({ type: 'choose-word', word: word2 });
  await new Promise(r => setTimeout(r, 500));
  state = await guestWs.waitForState();
  assert(state.status === 'playing', 'playing');
  assert(state.drawerId === join.playerId, 'guest is drawer');
  console.log('  OK');

  console.log('TEST 12: Non-drawer draw ignored');
  hostWs.sendJSON({ type: 'draw', event: { type: 'stroke', strokeId: 's2', points: [{x:0.3,y:0.3}], color: '#111827', size: 5, tool: 'pen' } });
  await new Promise(r => setTimeout(r, 300));
  const hostDraws = hostWs.getMessages().filter(m => m.type === 'draw' && m.event.strokeId === 's2');
  assert(hostDraws.length === 0, 'non-drawer stroke not broadcast');
  console.log('  OK');

  console.log('TEST 13: Round 2 guess');
  guestWs.sendJSON({ type: 'draw', event: { type: 'stroke', strokeId: 's3', points: [{x:0.4,y:0.4},{x:0.5,y:0.5}], color: '#111827', size: 5, tool: 'pen' } });
  await new Promise(r => setTimeout(r, 300));
  hostWs.sendJSON({ type: 'guess', text: word2 });
  await new Promise(r => setTimeout(r, 500));
  state = await hostWs.waitForState();
  assert(state.status === 'reveal', 'round 2 reveal');
  console.log('  OK');

  console.log('TEST 14: Game ends');
  await new Promise(r => setTimeout(r, 5500));
  state = await hostWs.waitForState();
  assert(state.status === 'ended', 'game ended');
  console.log('  OK');

  console.log('TEST 15: Reconnect');
  hostWs.close();
  await new Promise(r => setTimeout(r, 500));
  const hostWs2 = await connectWS(create.room.code, create.playerId, 'host2');
  state = await hostWs2.waitForState();
  assert(state.status === 'ended', 'still ended after reconnect');
  console.log('  OK');

  console.log('TEST 16: Leave and rejoin');
  hostWs2.close();
  await new Promise(r => setTimeout(r, 500));
  const rejoin = await api('/api/join', { name: 'HostRejoin', code: create.room.code, deviceId: dev + '-host' });
  assert(rejoin.playerId === create.playerId, 'same player on rejoin');
  console.log('  OK');

  console.log('TEST 17: Quick-play');
  const q1 = await api('/api/quick-play', { name: 'QP1', deviceId: dev + '-qp1' });
  assert(q1.room.isPublic === true, 'public room');
  const qws1 = await connectWS(q1.room.code, q1.playerId, 'qp1');
  state = await qws1.waitForState();
  assert(state.players.length >= 1, 'public has players');
  assert(state.maxPlayers === 4, 'public max players is 4');
  console.log('  OK', q1.room.code, 'players', state.players.length);

  const q2 = await api('/api/quick-play', { name: 'QP2', deviceId: dev + '-qp2' });
  const qws2 = await connectWS(q2.room.code, q2.playerId, 'qp2');
  state = await qws2.waitForState();
  assert(state.players.length >= 1, 'public has players');
  console.log('  OK players', state.players.length);

  guestWs.close();
  qws1.close();
  qws2.close();

  console.log('\nALL TESTS PASSED');
})().catch(e => {
  console.error('\nTEST FAILED:', e.message);
  process.exit(1);
});
