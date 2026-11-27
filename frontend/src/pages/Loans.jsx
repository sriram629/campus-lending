import { useState } from 'react';
import { api, LoanFilters, matchesLoan, PageHeader, LoanTable, Modal, Field, DeleteModal, formatDate } from '../components';

function nextWeek() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Loans({ data, save, initialAction, clearAction }) {
  const [search, setSearch] = useState('');
  const [field, setField] = useState('');
  const [filter, setFilter] = useState('');
  const [localModal, setLocalModal] = useState(null);
  const modal = localModal || initialAction;
  const records = data.loans.filter(loan => matchesLoan(loan, search, field) && (!filter || loan.status === filter));
  function close() { setLocalModal(null); clearAction(); }
  return <>
    <PageHeader title="Loans & returns" description="Track due dates and record returned items." action="Issue a loan" onAction={() => setLocalModal({ type: 'issue' })} />
    <section className="panel"><div className="panel-heading"><div><h2>Loan register</h2><p>Active loans and complete borrowing history.</p></div><span className="status">{data.loans.filter(loan => loan.status !== 'Returned').length} open loans</span></div>
      <LoanFilters search={search} setSearch={setSearch} field={field} setField={setField} status={filter} setStatus={setFilter} />
      <LoanTable loans={records} onEdit={record => setLocalModal({ type: 'edit', record })} onReturn={record => setLocalModal({ type: 'return', record })} onDelete={record => setLocalModal({ type: 'delete', record })} />
      <div className="panel-footer">Each equipment item can be returned separately.</div>
    </section>
    {modal?.type === 'issue' && <IssueLoan data={data} save={save} close={close} />}
    {modal?.type === 'edit' && <Modal title={`Edit loan #${modal.record.id}`} description={`Issued to ${modal.record.borrower} on ${formatDate(modal.record.issued_on)}.`} onClose={close} onSave={form => save(`loans/${modal.record.id}`, 'PUT', { due_on: form.get('due_on'), notes: form.get('notes') }, 'Loan updated.')}>
      <Field label="Due date"><input name="due_on" type="date" min={modal.record.issued_on} defaultValue={modal.record.due_on} required /></Field><Field label="Notes (optional)"><textarea name="notes" defaultValue={modal.record.notes} maxLength={1000} /></Field>
    </Modal>}
    {modal?.type === 'return' && <ReturnLoan record={modal.record} save={save} close={close} />}
    {modal?.type === 'delete' && <DeleteModal label={`loan #${modal.record.id} for ${modal.record.borrower}`} onClose={close} onDelete={() => save(`loans/${modal.record.id}`, 'DELETE', undefined, 'Completed loan deleted.')} />}
  </>;
}

function IssueLoan({ data, save, close }) {
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const remaining = student ? Math.max(0, 3 - student.items_out) : 0;
  async function lookup() {
    setLooking(true); setLookupError(''); setStudent(null); setSelected([]);
    try { setStudent(await api(`borrowers/lookup/${encodeURIComponent(studentId)}`)); }
    catch (error) { setLookupError(error.message); }
    finally { setLooking(false); }
  }
  function toggle(id) { setSelected(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]); }
  return <Modal title="Issue a loan" description="Find the student by ID, then choose up to three different items." onClose={close} submitLabel="Issue loan" submitDisabled={!student || !student.active || Boolean(student.restricted) || !remaining || !selected.length} onSave={form => {
    if (!student || student.campus_id !== studentId) throw new Error('Find the student before issuing a loan.');
    if (student.restricted) throw new Error('Borrowing restricted after a damaged return. Update the student status in Borrowers first.');
    if (!student.active) throw new Error('This student is inactive.');
    if (!remaining) throw new Error('3 items completed. Return an item before borrowing another.');
    if (!selected.length) throw new Error('Select at least one item.');
    return save('loans', 'POST', { borrower_id: student.id, equipment_ids: selected, due_on: form.get('due_on'), notes: form.get('notes') }, 'Loan issued. Stock updated.');
  }}>
    <div className="student-lookup"><Field label="Student ID"><input value={studentId} disabled={looking} onChange={e => { setStudentId(e.target.value.toUpperCase()); setStudent(null); setSelected([]); setLookupError(''); }} pattern="S00480[0-9]{3}" maxLength={9} placeholder="S00480001" required onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!looking) lookup(); } }} /></Field><button type="button" disabled={looking || !/^S00480\d{3}$/.test(studentId)} onClick={lookup}>{looking ? 'Finding…' : 'Find student'}</button></div>
    {lookupError && <p className="error-message" role="alert">{lookupError}</p>}
    {student && <div className="student-summary"><strong>{student.name}</strong><p>{student.campus_id} · {student.department}</p><p>{student.email}</p><p>{student.items_out} / 3 items borrowed · {remaining} remaining</p>{student.items.length > 0 && <p>Currently borrowed: {student.items.map(item => item.name).join(', ')}</p>}{Boolean(student.restricted) && <p role="alert" className="error-message">Borrowing restricted after a damaged return. Staff must clear the restriction in Borrowers before another loan can be issued.</p>}{!student.active && <p role="alert">This student is inactive.</p>}{!remaining && <p role="alert">3 items completed. Return an item before borrowing another.</p>}</div>}
    <Field label="Due date"><input name="due_on" type="date" defaultValue={nextWeek()} required /></Field>
    {student?.active && !student.restricted && remaining > 0 && <fieldset className="equipment-selection"><legend>Choose equipment ({selected.length} / {remaining})</legend>
      <Field label="Find equipment"><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, code or category" /></Field>
      {data.equipment.filter(item => `${item.name} ${item.asset_tag} ${item.category}`.toLowerCase().includes(search.toLowerCase())).map(item => {
        const held = student.items.some(existing => existing.equipment_id === item.id);
        return <label className="checkbox-row" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={held || item.available < 1 || (!selected.includes(item.id) && selected.length >= remaining)} onChange={() => toggle(item.id)} /><span>{item.name}<small>{item.asset_tag} · {item.available} / {item.quantity} available{held ? ' · Already borrowed' : ''}</small></span></label>;
      })}
    </fieldset>}
    <Field label="Notes (optional)"><textarea name="notes" maxLength={1000} /></Field>
  </Modal>;
}

function ReturnLoan({ record, save, close }) {
  const open = record.items.filter(item => !item.returned_on);
  const [selected, setSelected] = useState(open.map(item => item.id));
  return <Modal title="Record a return" description={`Loan #${record.id} · ${record.borrower}`} onClose={close} submitLabel="Confirm return" onSave={form => save(`loans/${record.id}/return`, 'POST', {
    item_ids: selected,
    damaged_item_ids: selected.filter(id => form.get(`condition_${id}`) === 'damaged')
  }, 'Return recorded. Damaged items moved to maintenance.')}>
    <fieldset className="equipment-selection"><legend>Select received items and inspect their condition</legend>{open.map(item => <div className="return-item" key={item.id}>
      <label className="checkbox-row"><input type="checkbox" checked={selected.includes(item.id)} onChange={e => setSelected(e.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} /><span>{item.name}<small>{item.asset_tag}</small></span></label>
      {selected.includes(item.id) && <Field label={`Is ${item.name} damaged?`}><select name={`condition_${item.id}`} required defaultValue=""><option value="" disabled>Select condition</option><option value="good">No — ready to lend</option><option value="damaged">Yes — send to maintenance</option></select></Field>}
    </div>)}</fieldset><p className="form-hint">Damaged units remain unavailable until repaired. Update the maintenance count in Equipment after repair.</p>
  </Modal>;
}
