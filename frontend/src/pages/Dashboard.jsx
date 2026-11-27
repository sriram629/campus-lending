import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { PageHeader, LoanTable, LoanFilters, matchesLoan } from '../components';

export default function Dashboard({ data, navigate }) {
  const [search, setSearch] = useState('');
  const [field, setField] = useState('');
  const available = data.equipment.reduce((sum, item) => sum + item.available, 0);
  const total = data.equipment.reduce((sum, item) => sum + item.quantity, 0);
  const out = data.equipment.reduce((sum, item) => sum + item.on_loan, 0);
  const overdue = data.loans.filter(loan => loan.status === 'Overdue').length;
  const current = data.loans.filter(loan => loan.status !== 'Returned' && matchesLoan(loan, search, field)).sort((a, b) => a.due_on.localeCompare(b.due_on));
  return <>
    <PageHeader title="Dashboard" description="Equipment availability and current loans." action="Issue a loan" onAction={() => navigate('loans', { type: 'issue' })} />
    <div className="stats"><div className="stat"><span>Available equipment</span><strong>{available}<span> / {total}</span></strong><small>Ready to borrow</small></div><div className="stat"><span>Items on loan</span><strong>{out}</strong><small>With campus borrowers</small></div><div className={`stat ${overdue ? 'attention' : ''}`}><span>Overdue loans</span><strong>{overdue}</strong><small>{overdue ? 'Return follow-up needed' : 'No overdue loans'}</small></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Current loans</h2><p>Equipment currently with borrowers, ordered by due date.</p></div><button onClick={() => navigate('loans')}>View all loans<ArrowUpRight size={15} /></button></div><LoanFilters search={search} setSearch={setSearch} field={field} setField={setField} /><LoanTable loans={current} compact onEdit={loan => navigate('loans', { type: 'edit', record: loan })} onReturn={loan => navigate('loans', { type: 'return', record: loan })} /><div className="panel-footer">{current.length} open loan{current.length === 1 ? '' : 's'} · {data.borrowers.filter(person => person.active).length} active borrowers</div></section>
  </>;
}
