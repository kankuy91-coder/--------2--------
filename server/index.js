import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, 'data.json');
const secret = process.env.JWT_SECRET || 'questup-local-secret-change-me';
const gameCatalog = [
  { id: 'genshin', name: 'Genshin Adventure', genre: 'Open world RPG', color: '#d86b55', icon: '✦', level: 42, progress: 68, quests: 12, achievements: 24, provider: 'QuestUp demo connector' },
  { id: 'stardew', name: 'Stardew Valley', genre: 'Farming simulation', color: '#7aa05b', icon: '✿', level: 1, progress: 0, quests: 0, achievements: 0, provider: 'Manual connector' },
  { id: 'valorant', name: 'VALORANT', genre: 'Tactical shooter', color: '#d95d71', icon: '◇', level: 1, progress: 0, quests: 0, achievements: 0, provider: 'Manual connector' }
];
const seed = {
  users: [{ id: 'u-demo', name: 'Mira Chen', email: 'demo@questup.app', password: bcrypt.hashSync('questup123', 10), role: 'user', level: 42, xp: 6840, coins: 1280, streak: 12, gameIds: ['genshin'], gameAccounts: [{ gameId: 'genshin', playerId: 'mira-42' }] }],
  games: gameCatalog,
  quests: [
    { id: 'q1', gameId: 'genshin', title: 'Defeat the Shadow', description: 'Clear the forgotten ruins and defeat the shadow guardian.', type: 'Epic quest', reward: 420, progress: 80, due: 'Today', status: 'active' },
    { id: 'q2', gameId: 'genshin', title: 'Gather Moonpetals', description: 'Find rare moonpetals near the northern cliffs.', type: 'Daily quest', reward: 180, progress: 45, due: 'Tomorrow', status: 'active' },
    { id: 'q3', gameId: 'genshin', title: 'Visit the Sky Harbor', description: 'Reach the highest point of the harbor at sunset.', type: 'Exploration', reward: 260, progress: 100, due: 'Done', status: 'completed' }
  ],
  achievements: [
    { id: 'a1', title: 'First Blood', description: 'Defeat your first elite enemy', icon: '⚔', unlocked: true },
    { id: 'a2', title: 'Treasure Hunter', description: 'Open 50 hidden chests', icon: '◆', unlocked: true },
    { id: 'a3', title: 'Night Watch', description: 'Complete 7 daily quests', icon: '☾', unlocked: true },
    { id: 'a4', title: 'Sky Walker', description: 'Reach the highest peak', icon: '↟', unlocked: false },
    { id: 'a5', title: 'The Collector', description: 'Collect every rare item', icon: '✹', unlocked: false },
    { id: 'a6', title: 'Unbreakable', description: 'Win a battle with 1 HP', icon: '♜', unlocked: false }
  ]
};

function readData() {
  if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify(seed, null, 2));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  data.users = data.users.map(user => ({ ...user, gameIds: user.gameIds || (user.id === 'u-demo' ? ['genshin'] : []), gameAccounts: user.gameAccounts || (user.id === 'u-demo' ? [{ gameId: 'genshin', playerId: 'mira-42' }] : []) }));
  return data;
}
function writeData(data) { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); }
function publicUser(user) { const { password, ...safe } = user; return safe; }
function tokenFor(user) { return jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '2d' }); }
function auth(req, res, next) {
  try { req.auth = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), secret); next(); }
  catch { res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }); }
}

const app = express();
app.use(cors());
app.use(express.json());
app.get('/api/health', (_, res) => res.json({ ok: true, service: 'QuestUp API' }));
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบ และรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
  const data = readData();
  if (data.users.some(user => user.email === email.toLowerCase())) return res.status(409).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
  const user = { id: `u-${Date.now()}`, name, email: email.toLowerCase(), password: bcrypt.hashSync(password, 10), role: 'user', level: 1, xp: 0, coins: 200, streak: 0, gameIds: [], gameAccounts: [] };
  data.users.push(user); writeData(data);
  res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ', user: publicUser(user) });
});
app.post('/api/auth/login', (req, res) => {
  const data = readData(); const user = data.users.find(item => item.email === req.body.email?.toLowerCase());
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password)) return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  res.json({ token: tokenFor(user), user: publicUser(user) });
});
app.post('/api/auth/forgot-password', (req, res) => res.json({ message: `หากมีบัญชีของ ${req.body.email || 'อีเมลนี้'} ระบบจะส่งลิงก์รีเซ็ตให้` }));
app.get('/api/games/catalog', auth, (_, res) => res.json(gameCatalog));
app.post('/api/games/connect', auth, (req, res) => {
  const { gameId, playerId } = req.body; const data = readData(); const user = data.users.find(item => item.id === req.auth.id); const game = gameCatalog.find(item => item.id === gameId);
  if (!user || !game || !playerId?.trim()) return res.status(400).json({ message: 'กรุณาเลือกเกมและกรอก Player ID' });
  user.gameIds = [...new Set([...(user.gameIds || []), gameId])]; user.gameAccounts = [...(user.gameAccounts || []).filter(account => account.gameId !== gameId), { gameId, playerId: playerId.trim() }];
  if (!data.games.some(item => item.id === gameId)) data.games.push(game);
  writeData(data); res.json({ message: `เชื่อมต่อ ${game.name} สำเร็จ`, game, account: { gameId, playerId: playerId.trim() } });
});
app.post('/api/quests', auth, (req, res) => {
  const { gameId, title, description, reward } = req.body; const data = readData(); const user = data.users.find(item => item.id === req.auth.id);
  if (!user || !(user.gameIds || []).includes(gameId)) return res.status(403).json({ message: 'คุณยังไม่ได้เชื่อมต่อเกมนี้' });
  if (!title?.trim() || !description?.trim() || !Number.isFinite(Number(reward)) || Number(reward) < 1) return res.status(400).json({ message: 'กรุณากรอกข้อมูลภารกิจให้ครบ' });
  const quest = { id: `q-${Date.now()}`, gameId, title: title.trim(), description: description.trim(), type: 'Custom quest', reward: Number(reward), progress: 0, due: 'Today', status: 'active' };
  data.quests.push(quest); writeData(data); res.status(201).json({ message: 'เพิ่มภารกิจสำเร็จ', quest });
});
app.get('/api/dashboard', auth, (_, res) => { const data = readData(); const user = data.users.find(item => item.id === _.auth.id); if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' }); const gameIds = user.gameIds || []; res.json({ user: publicUser(user), games: data.games.filter(game => gameIds.includes(game.id)), quests: data.quests.filter(quest => gameIds.includes(quest.gameId)), achievements: data.achievements, gameAccounts: user.gameAccounts || [] }); });
app.patch('/api/quests/:id/complete', auth, (req, res) => {
  const data = readData(); const user = data.users.find(item => item.id === req.auth.id); const quest = data.quests.find(item => item.id === req.params.id);
  if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' });
  if (!quest) return res.status(404).json({ message: 'ไม่พบภารกิจ' });
  if (!(user.gameIds || []).includes(quest.gameId)) return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ทำภารกิจนี้' });
  if (quest.status === 'completed') return res.json(quest);
  quest.status = 'completed'; quest.progress = 100; user.xp = (user.xp || 0) + (quest.reward || 0); writeData(data); res.json(quest);
});
app.listen(process.env.PORT || 4000, () => console.log('QuestUp API running on http://localhost:4000'));
