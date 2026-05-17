import { useState, useEffect, useCallback } from 'react';
import { useERP } from '../context/erp-engine';
import { Product } from '../models/inventory.model';
import RecordList from '../components/RecordList';
import { BaseRecord } from '../lib/base-model';
import { X, Save, AlertCircle } from 'lucide-react';

type View = 'list' | 'form';

const INITIAL_FORM: Omit<Product, keyof BaseRecord> = {
  name: '',
  sku: '',
  category: '',
  unit: 'pcs',
  cost_price: 0,
  sale_price: 0,
  reorder_point: 10,
  current_stock: 0,
  warehouse_id: '',
};

export default function InventoryModule() {
  const { engine } = useERP();
  const [view, setView] = useState<View>('list');
  const [records, setRecords] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!engine) return;
    setLoading(true);
    try {
      const data = await engine.products.list();
      setRecords(data as Product[]);
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const openNew = () => {
    setSelected(null);
    setForm(INITIAL_FORM);
    setView('form');
  };

  const openEdit = (record: Product) => {
    setSelected(record);
    setForm({
      name: record.name,
      sku: record.sku,
      category: record.category,
      unit: record.unit,
      cost_price: record.cost_price,
      sale_price: record.sale_price,
      reorder_point: record.reorder_point,
      current_stock: record.current_stock,
      warehouse_id: record.warehouse_id,
    });
    setView('form');
  };

  const handleSave = async () => {
    if (!engine) return;
    setSaving(true);
    try {
      const record = selected
        ? await engine.products.save({ ...selected, ...form })
        : await engine.products.save(engine.products.create(form));
      setRecords((prev) =>
        selected ? prev.map((r) => (r.id === record.id ? record : r)) : [...prev, record]
      );
      setView('list');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Product Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    {
      key: 'current_stock',
      label: 'Stock',
      render: (r: Product) => (
        <span className={r.current_stock <= r.reorder_point ? 'text-amber-400 font-medium' : 'text-slate-300'}>
          {r.current_stock} {r.unit}
          {r.current_stock <= r.reorder_point && (
            <AlertCircle className="w-3 h-3 inline ml-1 text-amber-400" />
          )}
        </span>
      ),
    },
    {
      key: 'sale_price',
      label: 'Sale Price',
      render: (r: Product) => `$${r.sale_price?.toLocaleString()}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Product) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
          {r.status}
        </span>
      ),
    },
  ];

  if (view === 'form') {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">
            {selected ? 'Edit Product' : 'New Product'}
          </h1>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Product Name" required>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="e.g. Steel Rod 10mm"
              />
            </Field>
            <Field label="SKU">
              <input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="input-field"
                placeholder="e.g. STL-ROD-10"
              />
            </Field>
            <Field label="Category">
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-field"
                placeholder="e.g. Raw Materials"
              />
            </Field>
            <Field label="Unit">
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input-field"
                placeholder="pcs / kg / m"
              />
            </Field>
            <Field label="Cost Price ($)">
              <input
                type="number"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: +e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Sale Price ($)">
              <input
                type="number"
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: +e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Current Stock">
              <input
                type="number"
                value={form.current_stock}
                onChange={(e) => setForm({ ...form, current_stock: +e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Reorder Point">
              <input
                type="number"
                value={form.reorder_point}
                onChange={(e) => setForm({ ...form, reorder_point: +e.target.value })}
                className="input-field"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setView('list')} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save & Sync'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RecordList
      title="Inventory / Products"
      records={records}
      columns={columns}
      loading={loading}
      onNew={openNew}
      onSelect={openEdit}
      onRefresh={loadRecords}
    />
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
