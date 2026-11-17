import { useEffect, useState } from 'react';
import { LayoutDashboard, Laptop, Users, ClipboardList, GraduationCap, RefreshCw } from 'lucide-react';
import { api } from './components';
import Dashboard from './pages/Dashboard';
import Equipment from './pages/Equipment';
import Borrowers from './pages/Borrowers';
import Loans from './pages/Loans';

const pages = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['equipment', 'Equipment', Laptop],
  ['borrowers', 'Borrowers', Users],
  ['loans', 'Loans & returns', ClipboardList]
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [data, setData] = useState({ equipment: [], categories: [], borrowers: [], loans: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loanAction, setLoanAction] = useState(null);

  async function refresh() {
    const [equipment, categories, borrowers, loans] = await Promise.all([
      api('equipment'), api('equipment/categories'), api('borrowers'), api('loans')
    ]);
    setData({ equipment, categories, borrowers, loans });
  }
  async function load() {
    setLoading(true);
    setError('');
    try { await refresh(); } catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save(path, method, values, success = 'Changes saved.') {
    const result = await api(path, method, values);
    setMessage(success);
    setError('');
    try { await refresh(); } catch (error) { setError('Saved successfully, but the view could not refresh. Use Refresh to load current records.'); }
    return result;
  }
  function navigate(next, action = null) {
    setPage(next);
    setMessage('');
    setLoanAction(action);
  }
  const shared = { data, save };
  return <div className="app-shell">
    <aside className="sidebar"><a href="#" onClick={event => { event.preventDefault(); navigate('dashboard'); }} className="brand"><span className="brand-mark">CL</span><span>Campus Lending<small>Equipment desk</small></span></a>
      <div className="nav-label">WORKSPACE</div><nav aria-label="Main navigation">{pages.map(([key, label, Icon]) => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={18} strokeWidth={1.6} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><GraduationCap size={22} strokeWidth={1.5} /><span>Campus resource services<small>Staff workspace · Local</small></span></div>
    </aside>
    <main className="main"><div className="topbar"><span>Campus resources <span className="slash">/</span> {pages.find(item => item[0] === page)[1]}</span><button className="refresh-button" disabled={loading} onClick={load}><RefreshCw size={14} />Refresh</button></div>
      {message && <div role="status" className="notice">{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}>×</button></div>}
      {error && <div role="alert" className="error-message">{error}</div>}
      {loading ? <div className="loading" role="status">Loading campus records…</div> : error && !data.categories.length ? <div className="empty"><h2>Unable to load records</h2><p>Check the backend and database, then select Refresh.</p></div> : <>
        {page === 'dashboard' && <Dashboard {...shared} navigate={navigate} />}
        {page === 'equipment' && <Equipment {...shared} />}
        {page === 'borrowers' && <Borrowers {...shared} />}
        {page === 'loans' && <Loans {...shared} initialAction={loanAction} clearAction={() => setLoanAction(null)} />}
      </>}
      <footer><span>Campus Lending</span><span>Equipment management & lending</span></footer>
    </main>
  </div>;
}
