import { useState, useEffect, useCallback } from 'react';
import { useERP } from '../context/erp-engine';
import { ManufacturingOrder, ManufacturingOrderLine } from '../models/manufacturing.model';
import { Product } from '../models/inventory.model';
import RecordList from '../components/RecordList';
import { BaseRecord } from '../lib/base-model';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { v4 } from '../lib/uuid';

type View = 'list' | 'form';

export default function ManufacturingModule() {
  const { engine } = useERP();
  const [view, setView] = useState<View>('list');
  const [records, setRecords] = useState<ManufacturingOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ManufacturingOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    product_name: '',
    bom_id: '',
    planned_qty: 1,
    actual_qty: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    assigned_employees: [] as string[],
    components: [] as ManufacturingOrderLine[],
    labor_hours: 0,
    labor_cost: 0,
    total_cost: 0,
    warehouse_id: '',
  });

  const loadAll = useCallback(async () => {
    if (!engine) return;
    setLoading(true);
    try {
      const [orders, prods] = await Promise.all([
        engine.manufacturingOrders.list() as Promise<ManufacturingOrder[]>,
        engine.products.list() as Promise<Product[]>,
      ]);
      setRecords(orders);
      setProducts(prods.filter((p) => p.status === 'active'));
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openNew = () => {
    setSelected(null);
    setForm({ product_id: '', product_name: '', bom_id: '', planned_qty: 1, actual_qty: 0, start_date: new Date().toISOString().split('T')[0], end_date: '', assigned_employees: [], components: [], labor_hours: 0, labor_cost: 0, total_cost: 0, warehouse_id: '' });
    setView('form');
  };

  const addComponent = () => {
    setForm((f) => ({ ...f, components: [...f.components, { id: v4(), product_id: '', product_name: '', planned_qty: 1, actual_qty: 0 }] }));
  };

  const updateComponent = (id: string, patch: Partial<ManufacturingOrderLine>) => {
    setForm((f) => ({ ...f, components: f.components.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  };

  const removeComponent = (id: string) => setForm((f) => ({ ...f, components: f.components.filter((c) => c.id !== id) }));

  const selectFinishedProduct = (productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    setForm((f) => ({ ...f, product_id: productId, product_name: p?.name ?? '' }));
  };

  const selectComponentProduct = (compId: string, productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    updateComponent(compId, { product_id: p.id, product_name: p.name });
  };

  const handleSave = async (confirm = false) => {
    if (!engine) return;
    setSaving(true);
    try {
      let record: ManufacturingOrder;
      if (selected) {
        record = await engine.manufacturingOrders.save({ ...selected, ...form, status: confirm ? 'active' : selected.status });
      } else {
        const created = engine.manufacturingOrders.create(form);
        if (confirm) created.status = 'active';
        record = await engine.manufacturingOrders.save(created);
      }
      setRecords((prev) => selected ? prev.map((r) => (r.id === record.id ? record : r)) : [...prev, record]);
      setView('list');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'reference', label: 'Reference' },
    { key: 'product_name', label: 'Product' },
    { key: 'planned_qty', label: 'Planned Qty' },
    { key: 'actual_qty', label: 'Actual Qty' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'status', label: 'Status', render: (r: ManufacturingOrder) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{r.status}</span>
    )},
  ];

  if (view === 'form') {
    return (
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{selected ? `Edit ${selected.reference}` : 'New Manufacturing Order'}</h1>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Finished Product</label>
              <select value={form.product_id} onChange={(e) => selectFinishedProduct(e.target.value)} className="input-field">
                <option value="">Select product...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Planned Quantity</label>
              <input type="number" value={form.planned_qty} onChange={(e) => setForm({ ...form, planned_qty: +e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="field-label">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="field-label">End Date</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="field-label">Labor Hours</label>
              <input type="number" value={form.labor_hours} onChange={(e) => setForm({ ...form, labor_hours: +e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="field-label">Labor Cost ($)</label>
              <input type="number" value={form.labor_cost} onChange={(e) => setForm({ ...form, labor_cost: +e.target.value })} className="input-field" />
            </div>
          </div>

          {/* Components (Raw Materials) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Raw Material Components</span>
              <button onClick={addComponent} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Plus className="w-3.5 h-3.5" /> Add Component</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-2 text-left text-xs text-slate-500">Material</th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">Planned Qty</th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">Actual Qty</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {form.components.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-xs">No components. Add raw materials consumed in production.</td></tr>
                )}
                {form.components.map((comp) => (
                  <tr key={comp.id}>
                    <td className="px-4 py-2">
                      <select value={comp.product_id} onChange={(e) => selectComponentProduct(comp.id, e.target.value)} className="input-field text-xs py-1.5">
                        <option value="">Select material...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={comp.planned_qty} onChange={(e) => updateComponent(comp.id, { planned_qty: +e.target.value })} className="input-field text-xs py-1.5 w-24 text-right" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={comp.actual_qty} onChange={(e) => updateComponent(comp.id, { actual_qty: +e.target.value })} className="input-field text-xs py-1.5 w-24 text-right" />
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeComponent(comp.id)} className="text-slate-600 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-xs text-amber-300">
            Confirming this order will automatically deduct raw materials and add the finished product to stock via the Stock-Production Hook.
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setView('list')} className="btn-secondary">Cancel</button>
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary"><Save className="w-4 h-4" />Save Draft</button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary">Confirm & Sync</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RecordList
      title="Manufacturing Orders"
      records={records}
      columns={columns}
      loading={loading}
      onNew={openNew}
      onSelect={(r) => { setSelected(r); setForm({ product_id: r.product_id, product_name: r.product_name, bom_id: r.bom_id, planned_qty: r.planned_qty, actual_qty: r.actual_qty, start_date: r.start_date, end_date: r.end_date, assigned_employees: r.assigned_employees, components: r.components, labor_hours: r.labor_hours, labor_cost: r.labor_cost, total_cost: r.total_cost, warehouse_id: r.warehouse_id }); setView('form'); }}
      onRefresh={loadAll}
    />
  );
}
