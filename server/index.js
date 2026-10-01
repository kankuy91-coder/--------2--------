import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
if (isProduction && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured in production');
const secret = process.env.JWT_SECRET || 'questup-local-dev-secret-only';
const configuredAdminEmails = new Set((process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
const gameCatalog = [
  { id: 'genshin', name: 'Genshin Adventure', genre: 'Open world RPG', color: '#d86b55', icon: '✦', level: 42, progress: 68, quests: 12, achievements: 24, provider: 'QuestUp demo connector' },
  { id: 'stardew', name: 'Stardew Valley', genre: 'Farming simulation', color: '#7aa05b', icon: '✿', level: 1, progress: 0, quests: 0, achievements: 0, provider: 'Manual connector' },
  { id: 'valorant', name: 'VALORANT', genre: 'Tactical shooter', color: '#d95d71', icon: '◇', level: 1, progress: 0, quests: 0, achievements: 0, provider: 'Manual connector' }
];
const seed = {
  users: [{ id: 'u-demo', name: 'Mira Chen', email: 'demo@questup.app', password: bcrypt.hashSync('questup123', 10), role: 'user', level: 42, xp: 6840, coins: 1280, streak: 12 }],
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
  data.users = Array.isArray(data.users) ? data.users : [];
  data.quests = Array.isArray(data.quests) ? data.quests : [];
  data.achievements = Array.isArray(data.achievements) ? data.achievements : seed.achievements;

  if (data.schemaVersion !== 2) {
    const today = new Date();
    const toDate = offset => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const validDate = value => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    data.users = data.users.map(user => {
      const { gameIds, gameAccounts, ...cleanUser } = user;
      return cleanUser;
    });
    data.quests = data.quests.map(quest => {
      const dueLabel = String(quest.due || '').toLowerCase();
      const legacyDueDate = dueLabel === 'tomorrow' ? toDate(1) : toDate(0);
      const dueDate = validDate(quest.dueDate) ? quest.dueDate : legacyDueDate;
      return {
        ...quest,
        userId: quest.userId || 'u-demo',
        gameName: quest.gameName || gameCatalog.find(game => game.id === quest.gameId)?.name || 'เกมของฉัน',
        dueDate,
        due: dueDate,
        status: dueLabel === 'done' ? 'completed' : quest.status || 'active'
      };
    });
    data.schemaVersion = 2;
    writeData(data);
  }
  return data;
}
function writeData(data) { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); }
function publicUser(user) { const { password, ...safe } = user; if (configuredAdminEmails.has(user.email?.toLowerCase())) safe.role = 'admin'; return safe; }
function tokenFor(user) { return jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '2d' }); }
function auth(req, res, next) {
  try { req.auth = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), secret); next(); }
  catch { res.status(401).json({ message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }); }
}
function adminAuth(req, res, next) {
  const data = readData();
  const user = data.users.find(item => item.id === req.auth.id);
  if (!user || (user.role !== 'admin' && !configuredAdminEmails.has(user.email?.toLowerCase()))) {
    return res.status(403).json({ message: 'ต้องใช้บัญชีผู้ดูแลระบบ' });
  }
  req.adminUser = user;
  next();
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
  const user = { id: `u-${Date.now()}`, name, email: email.toLowerCase(), password: bcrypt.hashSync(password, 10), role: 'user', level: 1, xp: 0, coins: 200, streak: 0 };
  data.users.push(user); writeData(data);
  res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ', user: publicUser(user) });
});
app.post('/api/auth/login', (req, res) => {
  const data = readData(); const user = data.users.find(item => item.email === req.body.email?.toLowerCase());
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password)) return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  if (configuredAdminEmails.has(user.email.toLowerCase()) && user.role !== 'admin') { user.role = 'admin'; writeData(data); }
  res.json({ token: tokenFor(user), user: publicUser(user) });
});
app.post('/api/auth/forgot-password', (_, res) => res.status(501).json({ message: 'ระบบกู้คืนรหัสผ่านยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลเว็บไซต์' }));
app.get('/api/admin/overview', auth, adminAuth, (_, res) => {
  const data = readData();
  const users = data.users.map(user => ({ ...publicUser(user), reminderCount: data.quests.filter(quest => quest.userId === user.id).length }));
  const reminders = data.quests.map(quest => {
    const owner = data.users.find(user => user.id === quest.userId);
    return { ...quest, ownerName: owner?.name || 'Unknown user', ownerEmail: owner?.email || '' };
  });
  res.json({ users, reminders, totals: { users: users.length, reminders: reminders.length, active: reminders.filter(item => item.status !== 'completed').length } });
});
app.delete('/api/admin/reminders/:id', auth, adminAuth, (req, res) => {
  const data = readData();
  const index = data.quests.findIndex(quest => quest.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: 'ไม่พบภารกิจเตือนความจำ' });
  data.quests.splice(index, 1);
  writeData(data);
  res.json({ message: 'ลบภารกิจเตือนความจำแล้ว' });
});
app.post('/api/quests', auth, (req, res) => {
  const { gameName, title, description = '', dueDate } = req.body; const data = readData();
  if (!data.users.some(user => user.id === req.auth.id)) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' });
  if (!gameName?.trim() || !title?.trim() || !dueDate || Number.isNaN(Date.parse(dueDate))) return res.status(400).json({ message: 'กรุณากรอกชื่อเกม ภารกิจ และวันที่ให้ครบ' });
  const quest = { id: `q-${Date.now()}`, userId: req.auth.id, gameName: gameName.trim(), title: title.trim(), description: description.trim(), type: 'Personal reminder', reward: 0, progress: 0, due: dueDate, dueDate, status: 'active' };
  data.quests.push(quest); writeData(data); res.status(201).json({ message: 'บันทึกการเตือนความจำสำเร็จ', quest });
});
app.get('/api/dashboard', auth, (_, res) => { const data = readData(); const user = data.users.find(item => item.id === _.auth.id); if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' }); const quests = data.quests.filter(quest => quest.userId === user.id); const games = [...new Set(quests.map(quest => quest.gameName))].map((name, index) => ({ id: `game-${index}`, name, genre: 'Personal reminders', color: '#d86b55', icon: '✦' })); res.json({ user: publicUser(user), games, quests, achievements: data.achievements }); });
app.patch('/api/quests/:id/complete', auth, (req, res) => {
  const data = readData(); const user = data.users.find(item => item.id === req.auth.id); const quest = data.quests.find(item => item.id === req.params.id && item.userId === req.auth.id);
  if (!user) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้' });
  if (!quest) return res.status(404).json({ message: 'ไม่พบภารกิจ' });
  if (quest.status === 'completed') return res.json(quest);
  quest.status = 'completed'; quest.progress = 100; writeData(data); res.json(quest);
});
app.listen(process.env.PORT || 4000, () => console.log('QuestUp API running on http://localhost:4000'));
