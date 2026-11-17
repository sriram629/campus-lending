import { useState } from 'react';
import { PageHeader, SearchInput, LoanTable, Modal, Field, DeleteModal, formatDate } from '../components';

function nextWeek() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Loans({ data, save, initialAction, clearAction }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [localModal, setLocalModal] = useState(null);
  const modal = localModal || initialAction;
  const records = data.loans.filter(loan => `${loan.borrower} ${loan.campus_id} ${loan.id} ${loan.items.map(item => `${item.name} ${item.asset_tag}`).join(' ')}`.toLowerCase().includes(search.toLowerCase()) && (!filter || loan.status === filter));
  const available = data.equipment.filter(item => item.availability === 'Ready');
  const activeBorrowers = data.borrowers.filter(person => person.active);
  function close() { setLocalModal(null); clearAction(); }
  return <>
    <PageHeader title="Loans & returns" description="Track due dates and record returned items." action="Issue a loan" onAction={() => setLocalModal({ type: 'issue' })} />
    <section className="panel"><div className="panel-heading"><div><h2>Loan register</h2><p>Active loans and complete borrowing history.</p></div><span className="status">{data.loans.filter(loan => loan.status !== 'Returned').length} open loans</span></div>
      <div className="filters"><SearchInput value={search} onChange={setSearch} label="Search loans" /><label className="filter-select"><span className="sr-only">Loan status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All statuses</option>{['Active', 'Overdue', 'Returned'].map(status => <option key={status}>{status}</option>)}</select></label></div>
      <LoanTable loans={records} onEdit={record => setLocalModal({ type: 'edit', record })} onReturn={record => setLocalModal({ type: 'return', record })} onDelete={record => setLocalModal({ type: 'delete', record })} />
      <div className="panel-footer">Each equipment item can be returned separately.</div>
    </section>
    {modal?.type === 'issue' && <Modal title="Issue a loan" description="Choose a borrower and the equipment to issue." onClose={close} submitLabel="Issue loan" onSave={form => save('loans', 'POST', { borrower_id: Number(form.get('borrower_id')), equipment_ids: form.getAll('equipment_ids').map(Number), due_on: form.get('due_on'), notes: form.get('notes') }, 'Loan issued. Equipment availability updated.')}>
      <div className="form-grid"><Field label="Borrower"><select name="borrower_id" required defaultValue=""><option value="" disabled>Select a borrower</option>{activeBorrowers.map(person => <option key={person.id} value={person.id}>{person.name} · {person.campus_id}</option>)}</select></Field><Field label="Due date"><input name="due_on" type="date" defaultValue={nextWeek()} required /></Field></div>
      {!activeBorrowers.length && <p>Add an active borrower before issuing equipment.</p>}
      <fieldset className="equipment-selection"><legend>Available equipment</legend>{available.length ? available.map(item => <label className="checkbox-row" key={item.id}><input type="checkbox" name="equipment_ids" value={item.id} /><span>{item.name}<small>{item.asset_tag} · {item.location}</small></span></label>) : <p>No equipment is currently available.</p>}</fieldset>
      <Field label="Notes (optional)"><textarea name="notes" maxLength={1000} placeholder="Class project or borrowing purpose" /></Field>
    </Modal>}
    {modal?.type === 'edit' && <Modal title={`Edit loan #${modal.record.id}`} description={`Issued to ${modal.record.borrower} on ${formatDate(modal.record.issued_on)}.`} onClose={close} onSave={form => save(`loans/${modal.record.id}`, 'PUT', { due_on: form.get('due_on'), notes: form.get('notes') }, 'Loan updated.')}>
      <Field label="Due date"><input name="due_on" type="date" min={modal.record.issued_on} defaultValue={modal.record.due_on} required /></Field><Field label="Notes (optional)"><textarea name="notes" defaultValue={modal.record.notes} maxLength={1000} /></Field>
    </Modal>}
    {modal?.type === 'return' && <Modal title="Record a return" description={`Loan #${modal.record.id} · ${modal.record.borrower}`} onClose={close} submitLabel="Confirm return" onSave={form => save(`loans/${modal.record.id}/return`, 'POST', { item_ids: form.getAll('item_ids').map(Number) }, 'Return recorded. Equipment is available again.')}>
      <fieldset className="equipment-selection"><legend>Select the items received at the desk</legend>{modal.record.items.filter(item => !item.returned_on).map(item => <label className="checkbox-row" key={item.id}><input name="item_ids" type="checkbox" value={item.id} defaultChecked /><span>{item.name}<small>{item.asset_tag} · Due {formatDate(modal.record.due_on)}</small></span></label>)}</fieldset><p className="form-hint">After returning a damaged item, change its service status to Maintenance in Equipment.</p>
    </Modal>}
    {modal?.type === 'delete' && <DeleteModal label={`loan #${modal.record.id} for ${modal.record.borrower}`} onClose={close} onDelete={() => save(`loans/${modal.record.id}`, 'DELETE', undefined, 'Completed loan deleted.')} />}
  </>;
}
