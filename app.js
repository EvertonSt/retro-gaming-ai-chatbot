const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const CONSOLE = document.getElementById('consoleLog');
const MESSAGES = document.getElementById('messages');
const FORM = document.getElementById('chatForm');
const INPUT = document.getElementById('userInput');
const API_KEY_INPUT = document.getElementById('apiKey');

const SYSTEM_PROMPT = `You are the Retro Gaming AI Chatbot, an expert historian of retro gaming.
Scope: 1970s–1990s video games, arcade, 8-bit/16-bit consoles, cartridge games, handhelds, and early PC games.
Rules:
- Be concise and specific.
- If asked about modern games, briefly redirect to retro era or suggest a related classic.
- Name exact titles, years, developers, and memorable mechanics when possible.
- Tone: knowledgeable arcade enthusiast, concise, encouraging.`;

const TOPIC_MATCHES = [
  {
    keywords: ['nes', 'nintendo', 'super mario', 'zelda', 'megaman', 'metroid', 'castlevania', 'kid icarus', 'duck hunt', 'excitebike'],
    reply: 'NES classics: Super Mario Bros. (1985), The Legend of Zelda (1986), Metroid (1986), Mega Man 2 (1988), Castlevania (1986), and Kid Icarus (1986) all defined the era.'
  },
  {
    keywords: ['arcade', 'arcade history', 'pac-man', 'space invaders', 'asteroids', 'galaga', 'donkey kong', 'defender', 'centipede'],
    reply: 'Arcade golden age (1978–1983): Space Invaders (1978), Asteroids (1979), Pac-Man (1980), Donkey Kong (1981), and Galaga (1981) defined public play and score chasing culture.'
  },
  {
    keywords: ['contra', 'tip', 'beat', 'strategy', 'konami code'],
    reply: 'Contra tips: use the spread gun for crowd control, crouch to avoid grenades, and throw grenades vertically for vertical threats. The Konami Code grants 30 lives in many Konami titles.'
  },
  {
    keywords: ['1983', 'crash', 'crash', 'et', 'video game crash'],
    reply: 'The 1983 crash was caused by oversaturation, poor-quality licensed games like E.T., and loss of consumer trust. Nintendo reset the market with the NES in 1985 through stricter licensing and quality control.'
  },
  {
    keywords: ['sega', 'master system', 'genesis', 'sonic', 'alex kidd', 'phantasy star'],
    reply: 'Sega classics: Sonic the Hedgehog (1991) defined 16-bit speed, Phantasy Star (1987) pioneered RPG storytelling, and Alex Kidd in Miracle World (1986) was an earlier mascot platformer.'
  },
  {
    keywords: ['snes', 'super nintendo', 'super famicom', 'super mario world', 'chrono trigger', 'final fantasy', 'street fighter'],
    reply: 'SNES standouts: Super Mario World (1990), Chrono Trigger (1995), Final Fantasy VI (1994), Super Metroid (1994), and Street Fighter II (1992) defined 16-bit depth.'
  },
  {
    keywords: ['game boy', 'gameboy', 'tetris', 'pokemon', 'link\'s awakening', 'kirby'],
    reply: 'Game Boy milestones: Tetris (1989) drove mass adoption, The Legend of Zelda: Link\'s Awakening (1993) delivered a full adventure, and Kirby\'s Dream Land (1992) introduced pink ability-absorbing fun.'
  },
  {
    keywords: ['lynx', 'neo geo', 'tg-16', '16-bit', 'atari', 'jaguar', '3do', 'cd-i'],
    reply: 'Beyond the mainstream: Neo Geo (1990) made arcade-perfect home gaming expensive, Atari Jaguar (1993) and 3DO (1993) pushed multimedia hardware but failed against SNES/Genesis.'
  },
  {
    keywords: ['atari 2600', 'atari 7800', 'pitfall', 'adventure', 'space invaders', 'asteroids'],
    reply: 'Atari era: the Atari 2600 (1977) made home play mainstream with Pitfall! (1984), Adventure (1980), and ports of arcade hits. quality control and the crash ended the original dominance.'
  },
  {
    keywords: ['handheld', 'game & watch', 'wonderswan', 'neo geo pocket', 'gbc', 'game gear'],
    reply: 'Handheld lineage: Game & Watch (1980), Game Boy (1989), Game Gear (1990), Neo Geo Pocket (1998), and WonderSwan (1999) each tried to put full gaming in your pocket.'
  },
  {
    keywords: ['emulator', 'playing old games', 'preservation', 'rom', 'retroarch'],
    reply: 'Emulation tips: RetroArch is a good frontend for beginners, keep BIOS files legal/personal, use original controllers when possible, and prefer digital copies you own for smoother accuracy.'
  }
];

const FALLBACK = 'Great topic. Try asking about classic consoles (NES, SNES, Genesis), arcade history, Contra tips, the 1983 crash, Sega, handhelds, or specific retro games.';

const STORAGE_KEY = 'retro_chat_history';
const API_KEY_STORAGE_KEY = 'retro_openai_key';
let chatHistory = [];

function log(text) {
  const line = document.createElement('div');
  line.textContent = text;
  CONSOLE.appendChild(line);
  CONSOLE.scrollTop = CONSOLE.scrollHeight;
}

function renderMessage(text, sender) {
  const el = document.createElement('div');
  el.className = 'msg ' + sender;
  el.textContent = text;
  MESSAGES.appendChild(el);
  MESSAGES.scrollTop = MESSAGES.scrollHeight;
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
}

function loadHistory() {
  MESSAGES.innerHTML = '';
  chatHistory = [];
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      chatHistory = JSON.parse(saved);
    } catch (e) {
      chatHistory = [];
    }
  }

  if (!chatHistory || chatHistory.length === 0) {
    chatHistory = [{
      sender: 'bot',
      text: 'Welcome to the Retro Gaming AI Chatbot! 🕹️ I cover classic consoles, pixelated heroes, arcade history, cheat codes, and more. What do you want to know?'
    }];
    saveHistory();
  }

  chatHistory.forEach(msg => {
    renderMessage(msg.text, msg.sender);
  });
}

function addMessage(text, sender) {
  chatHistory.push({ sender, text });
  saveHistory();
  renderMessage(text, sender);
}

function pickTopicReply(userText) {
  const q = userText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
  for (const topic of TOPIC_MATCHES) {
    if (topic.keywords.some(k => q.includes(k))) {
      return topic.reply;
    }
  }
  return FALLBACK;
}

async function callLLM(userText) {
  const key = API_KEY_INPUT.value.trim();
  if (!key) {
    return pickTopicReply(userText);
  }

  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.4,
    max_tokens: 180,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText }
    ]
  };

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify(body)
  });

  log('API > ' + res.status + ' ' + res.statusText);

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data && data.error && data.error.message) || 'API error');
  }

  const reply = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
  if (!reply) throw new Error('Empty response from API');
  return reply;
}

async function onSend(text) {
  const userText = (text || INPUT.value).trim();
  if (!userText) return;

  addMessage(userText, 'user');
  INPUT.value = '';

  const placeholder = document.createElement('div');
  placeholder.className = 'msg bot';
  placeholder.textContent = 'Blowing the dust off the cartridges...';
  MESSAGES.appendChild(placeholder);
  MESSAGES.scrollTop = MESSAGES.scrollHeight;

  try {
    const reply = await callLLM(userText);
    placeholder.textContent = reply;
    chatHistory.push({ sender: 'bot', text: reply });
    saveHistory();
    log('Bot > ' + reply.slice(0, 80) + (reply.length > 80 ? '...' : ''));
  } catch (e) {
    const errorText = 'Error: ' + e.message;
    placeholder.textContent = errorText;
    chatHistory.push({ sender: 'bot', text: errorText });
    saveHistory();
    log('Error > ' + e.message);
  } finally {
    MESSAGES.scrollTop = MESSAGES.scrollHeight;
  }
}

// Hook up event listeners
FORM.addEventListener('submit', (e) => {
  e.preventDefault();
  onSend();
});

const RESET_CHAT_BTN = document.getElementById('resetChat');
let resetConfirmState = false;
let resetTimeout = null;

RESET_CHAT_BTN.addEventListener('click', () => {
  if (!resetConfirmState) {
    resetConfirmState = true;
    RESET_CHAT_BTN.textContent = 'SURE?';
    RESET_CHAT_BTN.classList.add('confirming');
    
    resetTimeout = setTimeout(() => {
      resetConfirmState = false;
      RESET_CHAT_BTN.textContent = 'Reset RAM';
      RESET_CHAT_BTN.classList.remove('confirming');
    }, 3000);
  } else {
    clearTimeout(resetTimeout);
    resetConfirmState = false;
    RESET_CHAT_BTN.textContent = 'Reset RAM';
    RESET_CHAT_BTN.classList.remove('confirming');
    
    localStorage.removeItem(STORAGE_KEY);
    loadHistory();
    log('System > Chat history cleared. RAM reset.');
  }
});

// Save API key on input change
API_KEY_INPUT.addEventListener('input', () => {
  localStorage.setItem(API_KEY_STORAGE_KEY, API_KEY_INPUT.value.trim());
});

// Handle suggestion chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const question = chip.getAttribute('data-q');
    onSend(question);
  });
});

// Initialization
const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
if (savedApiKey) {
  API_KEY_INPUT.value = savedApiKey;
}
loadHistory();
INPUT.focus();

