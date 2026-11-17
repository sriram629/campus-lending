import { ArrowUpRight } from 'lucide-react';
import { PageHeader, LoanTable } from '../components';

export default function Dashboard({ data, navigate }) {
  const available = data.equipment.filter(item => item.availability === 'Ready').length;
  const out = data.equipment.filter(item => item.availability === 'On loan').length;
  const overdue = data.loans.filter(loan => loan.status === 'Overdue').length;
  const current = data.loans.filter(loan => loan.status !== 'Returned').sort((a, b) => a.due_on.localeCompare(b.due_on));
  return <>
    <PageHeader title="Dashboard" description="Equipment availability and current loans." action="Issue a loan" onAction={() => navigate('loans', { type: 'issue' })} />
    <div className="stats"><div className="stat"><span>Available equipment</span><strong>{available}<span> / {data.equipment.length}</span></strong><small>Ready to borrow</small></div><div className="stat"><span>Items on loan</span><strong>{out}</strong><small>With campus borrowers</small></div><div className={`stat ${overdue ? 'attention' : ''}`}><span>Overdue loans</span><strong>{overdue}</strong><small>{overdue ? 'Return follow-up needed' : 'No overdue loans'}</small></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Current loans</h2><p>Equipment currently with borrowers, ordered by due date.</p></div><button onClick={() => navigate('loans')}>View all loans<ArrowUpRight size={15} /></button></div><LoanTable loans={current.slice(0, 6)} compact onReturn={loan => navigate('loans', { type: 'return', record: loan })} /><div className="panel-footer">{current.length} open loan{current.length === 1 ? '' : 's'} · {data.borrowers.filter(person => person.active).length} active borrowers</div></section>
  </>;
}
