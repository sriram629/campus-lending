import { useState } from 'react';
import { Plus, Tags } from 'lucide-react';
import { PageHeader, SearchInput, Empty, Modal, Field, DeleteModal } from '../components';

export default function Equipment({ data, save }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [form, setForm] = useState({});
  const [categoryName, setCategoryName] = useState('');
  const [categoryEdit, setCategoryEdit] = useState(null);
  const [categoryError, setCategoryError] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const records = data.equipment.filter(item => `${item.name} ${item.asset_tag} ${item.category} ${item.location}`.toLowerCase().includes(search.toLowerCase()) && (!category || String(item.category_id) === category) && (!filter || (filter === 'Available' ? item.available > 0 : filter === 'On loan' ? item.on_loan > 0 : item.maintenance_quantity > 0)));
  function edit(item = null) {
    setForm(item ? { ...item } : { asset_tag: '', name: '', category_id: data.categories[0]?.id || '', location: '', quantity: 1, maintenance_quantity: 0 });
    setModal({ type: 'edit', item });
  }
  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }); }
  async function saveCategory(event) {
    event.preventDefault();
    if (categoryBusy) return;
    setCategoryBusy(true); setCategoryError('');
    try {
      await save(`equipment/categories${categoryEdit ? `/${categoryEdit}` : ''}`, categoryEdit ? 'PUT' : 'POST', { name: categoryName }, 'Category saved.');
      setCategoryName(''); setCategoryEdit(null);
    } catch (error) { setCategoryError(error.message); }
    finally { setCategoryBusy(false); }
  }
  return <>
    <PageHeader title="Equipment" description="Manage the equipment available across campus." action="Add equipment" onAction={() => edit()} />
    <section className="panel"><div className="panel-heading"><div><h2>Equipment register</h2><p>{data.equipment.length} equipment types across {data.categories.length} categories</p></div><button onClick={() => setCategoriesOpen(!categoriesOpen)} aria-expanded={categoriesOpen}><Tags size={15} />Categories</button></div>
      {categoriesOpen && <div className="category-panel"><form onSubmit={saveCategory}><Field label={categoryEdit ? 'Rename category' : 'New category'}><input value={categoryName} onChange={event => setCategoryName(event.target.value)} maxLength={80} required placeholder="Category name" disabled={categoryBusy} /></Field><button type="submit" disabled={categoryBusy}><Plus size={14} />{categoryEdit ? 'Save' : 'Add'}</button>{categoryEdit && <button type="button" onClick={() => { setCategoryEdit(null); setCategoryName(''); }}>Cancel</button>}</form>{categoryError && <p role="alert" className="error-message">{categoryError}</p>}<div className="category-list">{data.categories.map(category => <div key={category.id}><span>{category.name}</span><button onClick={() => { setCategoryEdit(category.id); setCategoryName(category.name); }}>Rename</button><button onClick={() => setModal({ type: 'category-delete', item: category })}>Delete</button></div>)}</div></div>}
      <div className="filters"><SearchInput value={search} onChange={setSearch} label="Search name, code or category" /><label className="filter-select"><span className="sr-only">Equipment category</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{data.categories.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="filter-select"><span className="sr-only">Availability</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All availability</option>{['Available', 'On loan', 'Maintenance'].map(status => <option key={status}>{status}</option>)}</select></label></div>
      {!records.length ? <Empty /> : <div className="table-scroll"><table><thead><tr><th>Equipment</th><th>Category</th><th>Location</th><th>Availability</th><th className="actions-heading">Actions</th></tr></thead><tbody>{records.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.asset_tag}</small></td><td>{item.category}</td><td>{item.location}</td><td><strong>{item.available} available / {item.quantity} total</strong><small>{item.on_loan} borrowed · {item.maintenance_quantity} in maintenance</small></td><td><div className="row-actions"><button onClick={() => edit(item)} aria-label={`Edit ${item.asset_tag}`}>Edit</button><button onClick={() => setModal({ type: 'delete', item })} aria-label={`Delete ${item.asset_tag}`}>Delete</button></div></td></tr>)}</tbody></table></div>}
      <div className="panel-footer">{records.length} equipment record{records.length === 1 ? '' : 's'} shown</div>
    </section>
    {modal?.type === 'edit' && <Modal title={modal.item ? 'Edit equipment' : 'Add equipment'} description="Set total stock and the number in maintenance. Reduce maintenance after repairs to make those units available." onClose={() => setModal(null)} submitLabel={modal.item ? 'Save changes' : 'Add equipment'} onSave={() => save(`equipment${modal.item ? `/${modal.item.id}` : ''}`, modal.item ? 'PUT' : 'POST', { ...form, category_id: Number(form.category_id), quantity: Number(form.quantity), maintenance_quantity: Number(form.maintenance_quantity) }, 'Equipment saved.')}>
      <div className="form-grid"><Field label="Equipment name"><input name="name" value={form.name} onChange={change} maxLength={120} required /></Field><Field label="Equipment code"><input name="asset_tag" value={form.asset_tag} onChange={change} maxLength={40} required /></Field><Field label="Category"><select name="category_id" value={form.category_id} onChange={change} required><option value="" disabled>Select a category</option>{data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Storage location"><input name="location" value={form.location} onChange={change} maxLength={120} required /></Field><Field label="Total stock"><input name="quantity" type="number" min={modal.item?.on_loan || 0} max="10000" value={form.quantity} onChange={change} required /></Field><Field label="In maintenance"><input name="maintenance_quantity" type="number" min="0" max={Math.max(0, Number(form.quantity) - (modal.item?.on_loan || 0))} value={form.maintenance_quantity} onChange={change} required /></Field></div>
      {!data.categories.length && <p>Create a category using the Categories button before adding equipment.</p>}
    </Modal>}
    {['delete', 'category-delete'].includes(modal?.type) && <DeleteModal label={modal.item.name} onClose={() => setModal(null)} onDelete={() => save(`${modal.type === 'category-delete' ? 'equipment/categories' : 'equipment'}/${modal.item.id}`, 'DELETE', undefined, 'Record deleted.')} />}
  </>;
}
