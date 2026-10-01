import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Bell, Check, ChevronLeft, Flame, Home, LogOut, Plus, ScrollText, Shield, Swords, Trash2, Trophy, UserRound, X } from 'lucide-react';
import './styles.css';
import './connection.css';
import './admin.css';

const API_ROOT = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://questup-server.onrender.com' : 'http://localhost:4000');
const API = `${API_ROOT.replace(/\/$/, '')}/api`;

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, ...options });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw new Error(data.message || 'เกิดข้อผิดพลาด');
  return data;
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('questup-user') || 'null'); }
  catch { localStorage.removeItem('questup-user'); return null; }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('questup-token'));
  const [user, setUser] = useState(getStoredUser);
  const [view, setView] = useState('home');
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [loadingDashboard, setLoadingDashboard] = useState(Boolean(token));
  useEffect(() => {
    if (!token) {
      setDashboard(null);
      setLoadingDashboard(false);
      return;
    }
    let active = true;
    setLoadingDashboard(true);
    request('/dashboard', { token })
      .then(data => { if (active) setDashboard(data); })
      .catch(err => {
        if (!active) return;
        setError(err.message);
        localStorage.removeItem('questup-token');
        setToken(null);
        setDashboard(null);
      })
      .finally(() => { if (active) setLoadingDashboard(false); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    if (!dashboard || !Array.isArray(dashboard.quests)) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const due = dashboard.quests.filter(quest => quest.status !== 'completed' && quest.dueDate && quest.dueDate <= today);
    if (due.length) setError(`มี ${due.length} ภารกิจถึงกำหนดแล้ว`);
  }, [dashboard]);
  function login(result) { localStorage.setItem('questup-token', result.token); localStorage.setItem('questup-user', JSON.stringify(result.user)); setDashboard(null); setLoadingDashboard(true); setToken(result.token); setUser(result.user); }
  function logout() { localStorage.removeItem('questup-token'); localStorage.removeItem('questup-user'); setToken(null); setUser(null); setDashboard(null); setError(''); }
  async function addQuest(quest) { const result = await request('/quests', { method: 'POST', token, body: JSON.stringify(quest) }); const next = await request('/dashboard', { token }); setDashboard(next); setUser(next.user); setError(result.message); }
  async function completeQuest(id) {
    try {
      const result = await request(`/quests/${id}/complete`, { method: 'PATCH', token });
      const next = await request('/dashboard', { token });
      setDashboard(next);
      setUser(next.user);
      setSelectedQuest(result);
    } catch (err) { setError(err.message); }
  }
  if (token && loadingDashboard) return <main className="auth-page"><section className="auth-form"><p className="muted">กำลังโหลดข้อมูลของคุณ...</p></section></main>;
  if (!token || !dashboard) return <AuthScreen onLogin={login} error={error} setError={setError} />;
  const quests = Array.isArray(dashboard.quests) ? dashboard.quests : [];
  const achievements = Array.isArray(dashboard.achievements) ? dashboard.achievements : [];
  const games = Array.isArray(dashboard.games) ? dashboard.games : [];
  return <Shell user={user || { name: 'Player', level: 1 }} view={view} setView={setView} logout={logout}>
    {view === 'home' && <HomeView data={{ ...dashboard, quests, achievements }} onOpenQuest={quest => { setSelectedQuest(quest); setView('quest-detail'); }} setView={setView} />}
    {view === 'quests' && <QuestView quests={quests} onOpenQuest={quest => { setSelectedQuest(quest); setView('quest-detail'); }} onAddQuest={addQuest} setError={setError} />}
    {view === 'quest-detail' && selectedQuest && <QuestDetail quest={selectedQuest} onBack={() => setView('quests')} onComplete={completeQuest} />}
    {view === 'achievements' && <AchievementView achievements={achievements} />}
    {view === 'profile' && <ProfileView user={user || { name: 'Player', level: 1 }} games={games} />}
    {view === 'admin' && user?.role === 'admin' && <AdminView token={token} setError={setError} />}
    {error && <button className="toast" onClick={() => setError('')}>{error}<X size={15} /></button>}
  </Shell>;
}

function AuthScreen({ onLogin, error, setError }) {
  const [mode, setMode] = useState('login'); const [form, setForm] = useState({ name: '', email: '', password: '' }); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); setMessage(''); try { if (mode === 'forgot') { const result = await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: form.email }) }); setMessage(result.message); } else if (mode === 'register') { const result = await request('/auth/register', { method: 'POST', body: JSON.stringify(form) }); setMessage(result.message); setMode('login'); setForm({ ...form, password: '' }); } else { onLogin(await request('/auth/login', { method: 'POST', body: JSON.stringify(form) })); } } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <main className="auth-page"><div className="auth-art"><div className="brand-mark"><Swords size={22} /> QUESTUP</div><div className="orb orb-one" /><div className="orb orb-two" /><div className="auth-copy"><span className="eyebrow">YOUR ADVENTURE, ORGANIZED</span><h1>Make every quest<br /><em>count.</em></h1><p>Track the worlds you play, the missions you conquer, and the legend you are becoming.</p><div className="auth-stat"><Flame size={18} /><strong>12 day streak</strong><span>keep the run alive</span></div></div></div><section className="auth-form"><div className="mobile-brand"><Swords size={20} /> QUESTUP</div><span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : mode === 'register' ? 'JOIN THE PARTY' : 'ACCOUNT RECOVERY'}</span><h2>{mode === 'login' ? 'Sign in to your hub' : mode === 'register' ? 'Create your legend' : 'Find your way back'}</h2><p className="muted">{mode === 'forgot' ? 'ระบบกู้คืนรหัสผ่านยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลเว็บไซต์' : 'Your quests are waiting on the other side.'}</p>{error && <div className="success-message">{error}</div>}<form onSubmit={submit}>{mode === 'register' && <label>Display name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your adventurer name" /></label>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>{mode !== 'forgot' && <label>Password<input required minLength="6" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>}<button className="primary-button" disabled={busy}>{busy ? 'Loading...' : mode === 'login' ? 'Enter QuestUp' : mode === 'register' ? 'Create account' : 'Request recovery'} <ArrowRight size={17} /></button></form>{message && <div className="success-message"><Check size={16} /> {message}</div>}<div className="auth-switch">{mode === 'login' && <button onClick={() => setMode('forgot')}>Forgot password?</button>}<button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New to QuestUp? Create account' : 'Already have an account? Sign in'}</button></div><small className="demo-note">Demo access: demo@questup.app / questup123</small></section></main>;
}

function Shell({ user, view, setView, logout, children }) {
  const nav = [['home', Home, 'Home'], ['quests', ScrollText, 'Quests'], ['achievements', Trophy, 'Achievements'], ['profile', UserRound, 'Profile'], ...(user?.role === 'admin' ? [['admin', Shield, 'Admin']] : [])];
  const displayName = user?.name || 'Player';
  const displayLevel = user?.level || 1;
  return <div className="app-shell"><aside><div className="brand-mark"><Swords size={21} /> QUESTUP</div><div className="side-label">YOUR HUB</div><nav>{nav.map(([id, Icon, label]) => <button className={view === id ? 'active' : ''} key={id} onClick={() => setView(id)}><Icon size={18} /> {label}</button>)}</nav><div className="side-bottom"><div className="mini-user"><div className="avatar">{displayName.slice(0, 2).toUpperCase()}</div><div><strong>{displayName}</strong><small>Level {displayLevel}</small></div></div><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={17} /></button></div></aside><main className="content"><header><div><span className="eyebrow">QUESTUP REMINDERS</span><h2>{view === 'home' ? 'Good evening.' : nav.find(item => item[0] === view)?.[2] || 'Quest detail'}</h2></div><div className="header-actions"><button className="icon-button" title="Open reminders" aria-label="Open reminders" onClick={() => setView('quests')}><Bell size={18} /></button><div className="avatar">{displayName.slice(0, 2).toUpperCase()}</div></div></header>{children}</main><div className="mobile-nav">{nav.map(([id, Icon, label]) => <button className={view === id ? 'active' : ''} key={id} onClick={() => setView(id)}><Icon size={18} /><small>{label}</small></button>)}</div></div>;
}

function HomeView({ data, onOpenQuest, setView }) { const active = data.quests.filter(quest => quest.status !== 'completed'); const upcoming = [...active].sort((first, second) => (first.dueDate || '').localeCompare(second.dueDate || '')); return <div className="view-stack"><section className="hero-panel"><div><span className="eyebrow lime">PERSONAL REMINDERS</span><h1>Keep every quest on track.</h1><p>บันทึกภารกิจจากเกมต่าง ๆ และดูวันครบกำหนดได้ในที่เดียว</p><button className="dark-button" onClick={() => setView('quests')}>จัดการการเตือน <ArrowRight size={16} /></button></div></section><div className="metric-grid"><Metric icon={<ScrollText />} label="ภารกิจทั้งหมด" value={data.quests.length} detail={`${active.length} รายการที่ยังไม่เสร็จ`} /><Metric icon={<Bell />} label="กำลังเตือน" value={active.length} detail="รายการที่ต้องทำ" /><Metric icon={<Trophy />} label="เสร็จแล้ว" value={data.quests.length - active.length} detail="รายการ" /></div><section className="section-heading"><div><span className="eyebrow">UP NEXT</span><h3>ภารกิจที่กำลังจะถึง</h3></div><button className="text-button" onClick={() => setView('quests')}>ดูทั้งหมด <ArrowRight size={15} /></button></section><div className="quest-list">{upcoming.slice(0, 3).map(quest => <QuestRow key={quest.id} quest={quest} onClick={() => onOpenQuest(quest)} />)}</div></div>; }
function Metric({ icon, label, value, detail }) { return <div className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function QuestRow({ quest, onClick }) { return <button className="quest-row" onClick={onClick}><div className="quest-type"><ScrollText size={17} /></div><div className="quest-row-copy"><span>{quest.gameName} <b>· {quest.dueDate}</b></span><h4>{quest.title}</h4><div className="progress-line"><i style={{ width: `${quest.status === 'completed' ? 100 : 0}%` }} /></div></div><strong className="reward">{quest.status === 'completed' ? 'เสร็จแล้ว' : 'รอทำ'}</strong><ArrowRight size={17} /></button>; }
function QuestView({ quests, onOpenQuest, onAddQuest, setError }) { const [filter, setFilter] = useState('All quests'); const [showForm, setShowForm] = useState(true); const [form, setForm] = useState({ gameName: '', title: '', description: '', dueDate: '' }); async function submit(event) { event.preventDefault(); try { await onAddQuest(form); setForm({ gameName: '', title: '', description: '', dueDate: '' }); } catch (err) { setError(err.message); } } return <div className="view-stack"><div className="filter-bar">{['All quests', 'Active', 'Completed'].map(item => <button className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}<button className="dark-button" onClick={() => setShowForm(value => !value)}><Plus size={16} /> {showForm ? 'Close' : 'Add reminder'}</button></div>{showForm && <form className="connect-form" onSubmit={submit}><label>Game name<input required value={form.gameName} onChange={event => setForm({ ...form, gameName: event.target.value })} placeholder="เช่น Genshin Impact" /></label><label>Quest name<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="เช่น เก็บวัตถุดิบ" /></label><label>Description<input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="รายละเอียดเพิ่มเติม" /></label><label>Due date<input required type="date" value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} /></label><button className="primary-button">Save reminder <Check size={17} /></button></form>}<div className="quest-list full">{quests.filter(q => filter === 'All quests' || (filter === 'Active' ? q.status !== 'completed' : q.status === 'completed')).map(quest => <QuestRow key={quest.id} quest={quest} onClick={() => onOpenQuest(quest)} />)}</div></div>; }
function QuestDetail({ quest, onBack, onComplete }) { return <div className="view-stack detail-view"><button className="back-button" onClick={onBack}><ChevronLeft size={17} /> Back to reminders</button><div className="quest-detail-head"><div className="quest-type big"><ScrollText size={31} /></div><div><span className="eyebrow">{quest.gameName}</span><h1>{quest.title}</h1><p>{quest.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p></div></div><div className="detail-card"><div className="detail-card-top"><span>DUE DATE</span><strong>{quest.dueDate}</strong></div><div className="detail-facts"><span>Game <b>{quest.gameName}</b></span><span>Status <b>{quest.status === 'completed' ? 'Completed' : 'Pending'}</b></span></div></div><button className={`primary-button ${quest.status === 'completed' ? 'complete' : ''}`} disabled={quest.status === 'completed'} onClick={() => onComplete(quest.id)}>{quest.status === 'completed' ? <><Check size={18} /> Completed</> : <>Mark complete <Check size={17} /></>}</button></div>; }
function AchievementView({ achievements }) { return <div className="view-stack"><div className="achievement-summary"><div><span className="eyebrow lime">COLLECTION PROGRESS</span><h1>Small wins. Big legend.</h1></div><strong>{achievements.filter(a => a.unlocked).length}<small> / {achievements.length} unlocked</small></strong></div><div className="achievement-grid">{achievements.map(item => <div className={`achievement ${item.unlocked ? '' : 'locked'}`} key={item.id}><div className="achievement-icon">{item.unlocked ? item.icon : '🔒'}</div><h3>{item.title}</h3><p>{item.description}</p><span>{item.unlocked ? 'UNLOCKED' : 'LOCKED'}</span></div>)}</div></div>; }
function ProfileView({ user, games }) { return <div className="view-stack profile-view"><div className="profile-hero"><div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div><div><span className="eyebrow lime">PLAYER PROFILE</span><h1>{user.name}</h1><p>Personal reminder workspace</p></div></div><div className="profile-stats"><div><span>Saved games</span><strong>{games.length}</strong></div><div><span>Data source</span><strong>Manual</strong></div><div><span>Game access</span><strong>None</strong></div></div><p className="muted">QuestUp ไม่ขอ Player ID และไม่เข้าไปอ่านข้อมูลในเกม ทุกข้อมูลมาจากการกรอกของคุณเอง</p></div>; }

function AdminView({ token, setError }) {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  async function load() {
    try { setData(await request('/admin/overview', { token })); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [token]);
  async function removeReminder(id) {
    if (!window.confirm('ต้องการลบภารกิจเตือนความจำนี้หรือไม่?')) return;
    setBusyId(id);
    try { await request(`/admin/reminders/${id}`, { method: 'DELETE', token }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusyId(''); }
  }
  if (!data) return <section className="admin-panel"><p className="muted">กำลังโหลดข้อมูลผู้ดูแล...</p></section>;
  const normalizedQuery = query.trim().toLowerCase();
  const users = data.users.filter(item => `${item.name} ${item.email}`.toLowerCase().includes(normalizedQuery));
  const reminders = data.reminders.filter(item => `${item.title} ${item.gameName} ${item.ownerName} ${item.ownerEmail}`.toLowerCase().includes(normalizedQuery));
  return <div className="view-stack admin-view">
    <section className="admin-heading"><div><span className="eyebrow">QUESTUP CONTROL</span><h1>Admin dashboard</h1><p>จัดการบัญชีและภารกิจเตือนความจำ</p></div><label className="admin-search">ค้นหา<input value={query} onChange={event => setQuery(event.target.value)} placeholder="ชื่อ อีเมล หรือภารกิจ" /></label></section>
    <div className="metric-grid"><Metric icon={<UserRound />} label="บัญชีผู้ใช้" value={data.totals.users} detail="ทั้งหมด" /><Metric icon={<ScrollText />} label="รายการเตือน" value={data.totals.reminders} detail="ทั้งหมด" /><Metric icon={<Bell />} label="ยังไม่เสร็จ" value={data.totals.active} detail="รายการ" /></div>
    <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">ACCOUNTS</span><h3>ผู้ใช้</h3></div><span className="count-pill">{users.length}</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>สิทธิ์</th><th>รายการเตือน</th></tr></thead><tbody>{users.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td><td>{item.reminderCount}</td></tr>)}</tbody></table></div></section>
    <section className="admin-panel"><div className="section-heading"><div><span className="eyebrow">REMINDERS</span><h3>ภารกิจเตือนความจำ</h3></div><span className="count-pill">{reminders.length}</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ภารกิจ</th><th>เกม</th><th>เจ้าของ</th><th>กำหนด</th><th>สถานะ</th><th></th></tr></thead><tbody>{reminders.map(item => <tr key={item.id}><td>{item.title}</td><td>{item.gameName}</td><td>{item.ownerName}<small>{item.ownerEmail}</small></td><td>{item.dueDate}</td><td>{item.status}</td><td><button className="icon-button danger-action" title="ลบรายการ" aria-label={`ลบ ${item.title}`} disabled={busyId === item.id} onClick={() => removeReminder(item.id)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div></section>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
