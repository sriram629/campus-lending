import { useState } from 'react';
import { PageHeader, SearchInput, Status, Empty, Modal, Field, DeleteModal } from '../components';

export default function Borrowers({ data, save }) {
  const [search, setSearch] = useState('');
  const [field, setField] = useState('');
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const records = data.borrowers.filter(person => {
    const value = field === 'name' ? person.name : field === 'id' ? person.campus_id : `${person.name} ${person.campus_id} ${person.email} ${person.department}`;
    const status = person.restricted ? 'restricted' : String(person.active);
    return search.trim().toLowerCase().split(/\s+/).every(word => value.toLowerCase().includes(word)) && (!filter || status === filter);
  });
  function edit(person = null) {
    setForm(person ? { ...person } : { name: '', campus_id: '', email: '', department: '', active: 1 });
    setModal({ type: 'edit', person });
  }
  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }); }
  return <>
    <PageHeader title="Borrowers" description="Student borrowing records. Each student may hold up to three different items." action="Add borrower" onAction={() => edit()} />
    <section className="panel"><div className="panel-heading"><div><h2>Borrower directory</h2><p>Contact details and lending eligibility.</p></div><span className="status">{data.borrowers.filter(person => person.active && !person.restricted).length} eligible borrowers</span></div>
      <div className="filters"><SearchInput value={search} onChange={setSearch} label="Search borrowers by name or ID" /><label className="filter-select"><span className="sr-only">Borrower search field</span><select value={field} onChange={e => setField(e.target.value)}><option value="">All fields</option><option value="name">Name</option><option value="id">Student ID</option></select></label><label className="filter-select"><span className="sr-only">Borrower status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All borrowers</option><option value="1">Active</option><option value="0">Inactive</option><option value="restricted">Restricted</option></select></label></div>
      {!records.length ? <Empty /> : <div className="table-scroll"><table><thead><tr><th>Borrower</th><th>Campus ID</th><th>Department</th><th>Status</th><th className="actions-heading">Actions</th></tr></thead><tbody>{records.map(person => <tr key={person.id}><td><strong>{person.name}</strong><small>{person.email}</small></td><td>{person.campus_id}</td><td>{person.department}</td><td><Status>{person.restricted ? 'Restricted' : person.active ? 'Active' : 'Inactive'}</Status><small>{person.items_out} item(s) out</small></td><td><div className="row-actions"><button onClick={() => setModal({ type: 'status', person })} aria-label={`Update status for ${person.name}`}>Update status</button><button onClick={() => edit(person)} aria-label={`Edit ${person.name}`}>Edit</button><button onClick={() => setModal({ type: 'delete', person })} aria-label={`Delete ${person.name}`}>Delete</button></div></td></tr>)}</tbody></table></div>}
      <div className="panel-footer">{records.length} borrower record{records.length === 1 ? '' : 's'} shown</div>
    </section>
    {modal?.type === 'edit' && <Modal title={modal.person ? 'Edit borrower' : 'Add borrower'} onClose={() => setModal(null)} submitLabel={modal.person ? 'Save changes' : 'Add borrower'} onSave={() => save(`borrowers${modal.person ? `/${modal.person.id}` : ''}`, modal.person ? 'PUT' : 'POST', { ...form, active: Number(form.active) }, 'Borrower saved.')}>
      <div className="form-grid"><Field label="Full name"><input name="name" value={form.name} onChange={change} maxLength={120} required /></Field><Field label="Campus ID"><input name="campus_id" value={form.campus_id} onChange={change} pattern="S00480[0-9]{3}" placeholder="S00480001" title="S00480 followed by three digits" maxLength={9} required /></Field><Field label="Email address"><input name="email" type="email" value={form.email} onChange={change} maxLength={254} required /></Field><Field label="Department"><input name="department" value={form.department} onChange={change} maxLength={120} required /></Field><Field label="Lending eligibility"><select name="active" value={form.active} onChange={change}><option value="1">Active</option><option value="0">Inactive</option></select></Field></div>
    </Modal>}
    {modal?.type === 'status' && <Modal title={`Borrowing status: ${modal.person.name}`} description="A damaged return restricts new loans. Clear the restriction after the issue has been resolved. Equipment maintenance is managed separately." onClose={() => setModal(null)} onSave={form => save(`borrowers/${modal.person.id}/restriction`, 'PATCH', { restricted: Number(form.get('restricted')) }, 'Borrowing status updated.')}>
      <Field label="Borrowing restriction"><select name="restricted" defaultValue={modal.person.restricted ? '1' : '0'}><option value="0">Cleared — may borrow if active</option><option value="1">Restricted — cannot borrow</option></select></Field>
      {!modal.person.active && <p>This student is also inactive. Edit lending eligibility to Active before issuing a loan.</p>}
    </Modal>}
    {modal?.type === 'delete' && <DeleteModal label={modal.person.name} onClose={() => setModal(null)} onDelete={() => save(`borrowers/${modal.person.id}`, 'DELETE', undefined, 'Borrower deleted.')} />}
  </>;
}
