"""Serve the standalone Gemini voice chat UI."""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Gemini Voice Chat</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0c0c0e;
    --surface: #18181b;
    --border: #27272a;
    --primary: #6366f1;
    --primary-glow: rgba(99,102,241,.35);
    --text: #e4e4e7;
    --muted: #71717a;
    --ai-bubble: #1e1e24;
    --user-bubble: #312e81;
    --system-text: #52525b;
    --danger: #ef4444;
    --success: #22c55e;
    --warning: #f59e0b;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Header ── */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo svg { width: 22px; height: 22px; }
  .logo span { font-size: 15px; font-weight: 600; letter-spacing: -.3px; }
  .status-pill {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--muted);
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 999px; padding: 4px 10px;
  }
  .dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--muted); transition: background .3s;
  }
  .dot.connected   { background: var(--success); box-shadow: 0 0 6px var(--success); }
  .dot.connecting  { background: var(--warning); animation: blink 1s infinite; }
  .dot.error       { background: var(--danger); }

  /* ── Messages ── */
  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scroll-behavior: smooth;
  }
  #messages::-webkit-scrollbar { width: 4px; }
  #messages::-webkit-scrollbar-track { background: transparent; }
  #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  .msg-wrap {
    display: flex;
    animation: fadeUp .25s ease;
  }
  .msg-wrap.user  { justify-content: flex-end; }
  .msg-wrap.ai    { justify-content: flex-start; }
  .msg-wrap.system { justify-content: center; }

  .bubble {
    max-width: 72%;
    padding: 9px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.55;
  }
  .msg-wrap.ai   .bubble { background: var(--ai-bubble); border-bottom-left-radius: 4px; }
  .msg-wrap.user .bubble { background: var(--user-bubble); border-bottom-right-radius: 4px; }
  .msg-wrap.system .bubble {
    background: transparent; color: var(--system-text);
    font-size: 11px; padding: 2px 0;
  }

  .ai-label {
    font-size: 11px; color: var(--muted);
    margin-bottom: 4px; padding-left: 2px;
  }

  /* ── AI speaking indicator ── */
  .speaking-indicator {
    display: flex; align-items: center; gap: 5px;
    padding: 8px 14px;
    background: var(--ai-bubble);
    border-radius: 16px;
    border-bottom-left-radius: 4px;
    width: fit-content;
  }
  .bar {
    width: 3px; border-radius: 3px;
    background: var(--primary);
    animation: wave 1s ease-in-out infinite;
  }
  .bar:nth-child(1) { height: 8px;  animation-delay: 0s; }
  .bar:nth-child(2) { height: 14px; animation-delay: .15s; }
  .bar:nth-child(3) { height: 10px; animation-delay: .3s; }
  .bar:nth-child(4) { height: 16px; animation-delay: .1s; }
  .bar:nth-child(5) { height: 8px;  animation-delay: .25s; }

  /* ── Controls ── */
  footer {
    padding: 16px 20px 20px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .hint {
    font-size: 12px;
    color: var(--muted);
    min-height: 16px;
    text-align: center;
  }

  .controls { display: flex; align-items: center; gap: 16px; }

  .btn-connect {
    background: var(--primary); color: #fff;
    border: none; border-radius: 10px;
    padding: 9px 20px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: opacity .2s, transform .1s;
  }
  .btn-connect:hover { opacity: .85; }
  .btn-connect:active { transform: scale(.97); }
  .btn-connect.danger { background: var(--danger); }
  .btn-connect:disabled { opacity: .4; cursor: not-allowed; }

  .btn-mic {
    width: 64px; height: 64px; border-radius: 50%;
    border: none; cursor: pointer;
    background: var(--primary);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    position: relative;
    transition: background .2s, transform .1s;
    box-shadow: 0 0 0 0 var(--primary-glow);
  }
  .btn-mic:disabled { opacity: .35; cursor: not-allowed; }
  .btn-mic:not(:disabled):hover { transform: scale(1.05); }
  .btn-mic.recording {
    background: var(--danger);
    animation: pulse-ring 1.4s ease infinite;
  }
  .btn-mic svg { width: 26px; height: 26px; pointer-events: none; }

  /* ── Empty state ── */
  .empty {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px; color: var(--muted);
    text-align: center; padding: 40px;
  }
  .empty svg { width: 48px; height: 48px; opacity: .25; }
  .empty p { font-size: 14px; }

  /* ── Animations ── */
  @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes wave    { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(.4)} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 var(--primary-glow); }
    70%  { box-shadow: 0 0 0 18px rgba(99,102,241,0); }
    100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  }
</style>
</head>
<body>

<header>
  <div class="logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
      <path d="M12 2a10 10 0 1 0 10 10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
    <span>Gemini Voice</span>
  </div>
  <div class="status-pill">
    <div class="dot" id="dot"></div>
    <span id="status-text">Disconnected</span>
  </div>
</header>

<div id="messages">
  <div class="empty" id="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
    </svg>
    <p>Click <strong>Connect</strong> to start talking with Gemini</p>
  </div>
</div>

<footer>
  <div class="hint" id="hint"></div>
  <div class="controls">
    <button class="btn-connect" id="btn-connect">Connect</button>
    <button class="btn-mic" id="btn-mic" disabled title="Hold or click to speak">
      <svg id="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
      </svg>
    </button>
  </div>
</footer>

<script>
const WS_URL = `ws://localhost:8000/ws/ivas/viva`;

// ── State ──
let ws = null;
let audioCtx = null;
let mediaStream = null;
let processor = null;
let isRecording = false;
let speakingEl = null;
let connected = false;

// ── DOM ──
const messagesEl   = document.getElementById('messages');
const emptyEl      = document.getElementById('empty-state');
const dotEl        = document.getElementById('dot');
const statusEl     = document.getElementById('status-text');
const hintEl       = document.getElementById('hint');
const btnConnect   = document.getElementById('btn-connect');
const btnMic       = document.getElementById('btn-mic');
const micIcon      = document.getElementById('mic-icon');

// ── Helpers ──
function setStatus(state, text) {
  dotEl.className = 'dot ' + state;
  statusEl.textContent = text;
}

function setHint(text) { hintEl.textContent = text; }

function addMessage(role, content) {
  emptyEl.style.display = 'none';
  hideSpeakingIndicator();

  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + role;

  if (role === 'system') {
    wrap.innerHTML = `<div class="bubble">${content}</div>`;
  } else if (role === 'ai') {
    wrap.innerHTML = `
      <div>
        <div class="ai-label">Gemini</div>
        <div class="bubble">${content}</div>
      </div>`;
  } else {
    wrap.innerHTML = `<div class="bubble">${content}</div>`;
  }

  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showSpeakingIndicator() {
  if (speakingEl) return;
  emptyEl.style.display = 'none';
  speakingEl = document.createElement('div');
  speakingEl.className = 'msg-wrap ai';
  speakingEl.innerHTML = `
    <div>
      <div class="ai-label">Gemini</div>
      <div class="speaking-indicator">
        <div class="bar"></div><div class="bar"></div>
        <div class="bar"></div><div class="bar"></div>
        <div class="bar"></div>
      </div>
    </div>`;
  messagesEl.appendChild(speakingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function hideSpeakingIndicator() {
  if (speakingEl) { speakingEl.remove(); speakingEl = null; }
}

// ── Audio playback (Gemini → speaker) ──
let playQueue = Promise.resolve();
function enqueueAudio(b64) {
  playQueue = playQueue.then(() => playAudio(b64)).catch(() => {});
}

async function playAudio(b64) {
  if (!audioCtx) audioCtx = new AudioContext({ sampleRate: 24000 });
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const raw   = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  const pcm16  = new Int16Array(bytes.buffer);
  const f32    = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;

  const buf = audioCtx.createBuffer(1, f32.length, 24000);
  buf.getChannelData(0).set(f32);

  return new Promise(resolve => {
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.onended = resolve;
    src.start();
  });
}

// ── Mic recording (mic → Gemini) ──
async function startRecording() {
  if (isRecording) return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    if (!audioCtx) audioCtx = new AudioContext({ sampleRate: 16000 });
    else if (audioCtx.sampleRate !== 16000) {
      audioCtx = new AudioContext({ sampleRate: 16000 });
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const source = audioCtx.createMediaStreamSource(mediaStream);
    processor    = audioCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = e => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      let bin = '';
      const view = new Uint8Array(pcm16.buffer);
      for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
      ws.send(JSON.stringify({ type: 'audio', data: btoa(bin) }));
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);

    isRecording = true;
    btnMic.classList.add('recording');
    btnMic.title = 'Click to stop';
    setHint('Listening… click mic to mute');
  } catch {
    setHint('Microphone access denied');
  }
}

function stopRecording() {
  if (!isRecording) return;
  processor?.disconnect();
  processor = null;
  mediaStream?.getTracks().forEach(t => t.stop());
  mediaStream = null;
  isRecording = false;
  btnMic.classList.remove('recording');
  btnMic.title = 'Click to speak';
  setHint('Click mic to speak');
}

// ── WebSocket ──
function connect() {
  setStatus('connecting', 'Connecting…');
  btnConnect.disabled = true;
  setHint('');

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    connected = true;
    setStatus('connected', 'Connected');
    btnConnect.textContent = 'Disconnect';
    btnConnect.classList.add('danger');
    btnConnect.disabled = false;
    btnMic.disabled = false;
    setHint('Click mic to speak');
  };

  ws.onmessage = e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    switch (msg.type) {
      case 'audio':
        showSpeakingIndicator();
        enqueueAudio(msg.data);
        break;
      case 'text':
        if (msg.data?.trim()) addMessage('ai', msg.data);
        break;
      case 'turn_complete':
        hideSpeakingIndicator();
        break;
      case 'session_ended':
        addMessage('system', 'Session ended');
        disconnect(false);
        break;
      case 'error':
        addMessage('system', '⚠ ' + (msg.data || 'Unknown error'));
        break;
      case 'pong':
        break;
    }
  };

  ws.onclose = () => { if (connected) disconnect(false); };
  ws.onerror = () => { setStatus('error', 'Error'); setHint('Connection failed — try reconnecting'); };
}

function disconnect(sendEnd = true) {
  if (sendEnd && ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'end_session' }));
  }
  stopRecording();
  ws?.close();
  ws = null;
  connected = false;
  setStatus('', 'Disconnected');
  btnConnect.textContent = 'Connect';
  btnConnect.classList.remove('danger');
  btnConnect.disabled = false;
  btnMic.disabled = true;
  setHint('');
}

// ── Events ──
btnConnect.addEventListener('click', () => {
  if (connected) disconnect(); else connect();
});

btnMic.addEventListener('click', () => {
  if (isRecording) stopRecording(); else startRecording();
});

window.addEventListener('beforeunload', () => disconnect());
</script>
</body>
</html>"""


@router.get("/viva", response_class=HTMLResponse, include_in_schema=False)
async def chat_ui() -> HTMLResponse:
    return HTMLResponse(content=_HTML)
