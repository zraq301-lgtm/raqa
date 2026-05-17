import { useState, useEffect, useCallback } from 'react';
import { useERP } from '../context/erp-engine';
import { Warehouse } from '../models/inventory.model';
import RecordList from '../components/RecordList';
import { BaseRecord } from '../lib/base-model';
import { X, Save } from 'lucide-react';

type View = 'list' | 'form';

export default function WarehousesModule() {
  const { engine } = useERP();
  const [view, setView] = useState<View>('list');
  const [records, setRecords] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({ name: '', location: '', manager_id: '', capacity: 0 });
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!engine) return;
    setLoading(true);
    try { setRecords((await engine.warehouses.list()) as Warehouse[]); }
    finally { setLoading(false); }
  }, [engine]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const openNew = () => { setSelected(null); setForm({ name: '', location: '', manager_id: '', capacity: 0 }); setView('form'); };
  const openEdit = (r: Warehouse) => { setSelected(r); setForm({ name: r.name, location: r.location, manager_id: r.manager_id, capacity: r.capacity }); setView('form'); };

  const handleSave = async () => {
    if (!engine) return;
    setSaving(true);
    try {
      const record = selected
        ? await engine.warehouses.save({ ...selected, ...form })
        : await engine.warehouses.save(engine.warehouses.create(form));
      setRecords((prev) => selected ? prev.map((r) => (r.id === record.id ? record : r)) : [...prev, record]);
      setView('list');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'name', label: 'Warehouse Name' },
    { key: 'location', label: 'Location' },
    { key: 'capacity', label: 'Capacity', render: (r: Warehouse) => r.capacity ? `${r.capacity.toLocaleString()} units` : '-' },
    { key: 'status', label: 'Status', render: (r: Warehouse) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{r.status}</span>
    )},
  ];

  if (view === 'form') {
    return (
      <div className="p-6 max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{selected ? 'Edit Warehouse' : 'New Warehouse'}</h1>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="field-label">Warehouse Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. Main Warehouse" />
          </div>
          <div>
            <label className="field-label">Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field" placeholder="e.g. Riyadh, KSA" />
          </div>
          <div>
            <label className="field-label">Capacity (units)</label>
            <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} className="input-field" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button onClick={() => setView('list')} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save & Sync'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RecordList
      title="Warehouses"
      records={records}
      columns={columns}
      loading={loading}
      onNew={openNew}
      onSelect={openEdit}
      onRefresh={loadRecords}
    />
  );
}
