import { useState } from 'react';
import { PageHeader, SearchInput, Status, Empty, Modal, Field, DeleteModal } from '../components';

export default function Borrowers({ data, save }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const records = data.borrowers.filter(person => `${person.name} ${person.campus_id} ${person.email} ${person.department}`.toLowerCase().includes(search.toLowerCase()) && (filter === '' || String(person.active) === filter));
  function edit(person = null) {
    setForm(person ? { ...person } : { name: '', campus_id: '', email: '', department: '', active: 1 });
    setModal({ type: 'edit', person });
  }
  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }); }
  return <>
    <PageHeader title="Borrowers" description="Student and staff borrowing records." action="Add borrower" onAction={() => edit()} />
    <section className="panel"><div className="panel-heading"><div><h2>Borrower directory</h2><p>Contact details and lending eligibility.</p></div><span className="status">{data.borrowers.filter(person => person.active).length} active borrowers</span></div>
      <div className="filters"><SearchInput value={search} onChange={setSearch} label="Search borrowers" /><label className="filter-select"><span className="sr-only">Borrower status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All borrowers</option><option value="1">Active</option><option value="0">Inactive</option></select></label></div>
      {!records.length ? <Empty /> : <div className="table-scroll"><table><thead><tr><th>Borrower</th><th>Campus ID</th><th>Department</th><th>Status</th><th className="actions-heading">Actions</th></tr></thead><tbody>{records.map(person => <tr key={person.id}><td><strong>{person.name}</strong><small>{person.email}</small></td><td>{person.campus_id}</td><td>{person.department}</td><td><Status>{person.active ? 'Active' : 'Inactive'}</Status><small>{person.items_out} item(s) out</small></td><td><div className="row-actions"><button onClick={() => edit(person)} aria-label={`Edit ${person.name}`}>Edit</button><button onClick={() => setModal({ type: 'delete', person })} aria-label={`Delete ${person.name}`}>Delete</button></div></td></tr>)}</tbody></table></div>}
      <div className="panel-footer">{records.length} borrower record{records.length === 1 ? '' : 's'} shown</div>
    </section>
    {modal?.type === 'edit' && <Modal title={modal.person ? 'Edit borrower' : 'Add borrower'} onClose={() => setModal(null)} submitLabel={modal.person ? 'Save changes' : 'Add borrower'} onSave={() => save(`borrowers${modal.person ? `/${modal.person.id}` : ''}`, modal.person ? 'PUT' : 'POST', { ...form, active: Number(form.active) }, 'Borrower saved.')}>
      <div className="form-grid"><Field label="Full name"><input name="name" value={form.name} onChange={change} maxLength={120} required /></Field><Field label="Campus ID"><input name="campus_id" value={form.campus_id} onChange={change} maxLength={40} required /></Field><Field label="Email address"><input name="email" type="email" value={form.email} onChange={change} maxLength={254} required /></Field><Field label="Department"><input name="department" value={form.department} onChange={change} maxLength={120} required /></Field><Field label="Lending eligibility"><select name="active" value={form.active} onChange={change}><option value="1">Active</option><option value="0">Inactive</option></select></Field></div>
    </Modal>}
    {modal?.type === 'delete' && <DeleteModal label={modal.person.name} onClose={() => setModal(null)} onDelete={() => save(`borrowers/${modal.person.id}`, 'DELETE', undefined, 'Borrower deleted.')} />}
  </>;
}
