import { useEffect, useRef, useState } from 'react';
import { X, Search, ArrowUpRight, Plus } from 'lucide-react';

export async function api(path, method = 'GET', data) {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  const result = await response.json().catch(() => ({ error: 'The server returned an invalid response.' }));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

export function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Status({ children }) {
  const style = ['Overdue', 'Maintenance', 'Needs repair'].includes(children) ? 'dark' : ['Inactive', 'Retired', 'Returned'].includes(children) ? 'muted' : '';
  return <span className={`status ${style}`}>{children}</span>;
}

export function PageHeader({ title, description, action, onAction }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action && <button className="primary" onClick={onAction}><Plus size={16} />{action}</button>}</header>;
}

export function SearchInput({ value, onChange, label = 'Search records' }) {
  return <label className="search"><Search size={16} aria-hidden="true" /><span className="sr-only">{label}</span><input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={label} /></label>;
}

export function Empty({ children }) {
  return <div className="empty"><h3>No matching records</h3><p>{children || 'Add a record or adjust your search and filters.'}</p></div>;
}

export function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export function Modal({ title, children, onClose, onSave, submitLabel = 'Save changes', description }) {
  const ref = useRef(null);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave(new FormData(event.currentTarget));
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return <dialog ref={ref} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-heading"><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}><fieldset disabled={busy} className="modal-fields">{children}</fieldset>{error && <p className="error-message" role="alert">{error}</p>}<div className="form-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></div></form>
  </dialog>;
}

export function DeleteModal({ label, onClose, onDelete }) {
  return <Modal title="Delete record" onClose={onClose} onSave={onDelete} submitLabel="Delete record"><p className="delete-copy">Delete <strong>{label}</strong>? This permanently removes the record. Records linked to loan history are protected.</p></Modal>;
}

export function LoanTable({ loans, onEdit, onReturn, onDelete, compact = false }) {
  if (!loans.length) return <Empty>No loans match this view.</Empty>;
  return <div className="table-scroll"><table><thead><tr><th>Borrower / loan</th><th>Equipment</th><th>Due date</th><th>Status</th><th className="actions-heading">Actions</th></tr></thead><tbody>{loans.map(loan => <tr key={loan.id}>
    <td><strong>{loan.borrower}</strong><small>#{String(loan.id).padStart(4, '0')} · {loan.campus_id}</small></td>
    <td>{loan.items.map(item => <div className="loan-item" key={item.id}><span>{item.name}</span><small>{item.asset_tag}{item.returned_on ? ` · Returned ${formatDate(item.returned_on)}` : ''}</small></div>)}</td>
    <td className="date-cell">{formatDate(loan.due_on)}</td><td><Status>{loan.status}</Status></td>
    <td><div className="row-actions">{!compact && <button onClick={() => onEdit(loan)} aria-label={`Edit loan ${loan.id}`}>Edit</button>}{loan.status !== 'Returned' ? <button onClick={() => onReturn(loan)} aria-label={`Return items for loan ${loan.id}`}>Return<ArrowUpRight size={12} /></button> : !compact && <button onClick={() => onDelete(loan)} aria-label={`Delete loan ${loan.id}`}>Delete</button>}</div></td>
  </tr>)}</tbody></table></div>;
}
