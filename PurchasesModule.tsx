import { useState, useEffect, useCallback } from 'react';
import { useERP } from '../context/erp-engine';
import { PurchaseOrder, PurchaseOrderLine, Vendor } from '../models/vendor.model';
import { Product } from '../models/inventory.model';
import RecordList from '../components/RecordList';
import { BaseRecord } from '../lib/base-model';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { v4 } from '../lib/uuid';

type View = 'list' | 'form' | 'vendors';

export default function PurchasesModule() {
  const { engine } = useERP();
  const [view, setView] = useState<View>('list');
  const [records, setRecords] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor_id: '',
    vendor_name: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    currency: 'USD',
    notes: '',
    lines: [] as PurchaseOrderLine[],
  });

  const loadAll = useCallback(async () => {
    if (!engine) return;
    setLoading(true);
    try {
      const [orders, vends, prods] = await Promise.all([
        engine.purchaseOrders.list() as Promise<PurchaseOrder[]>,
        engine.vendors.list() as Promise<Vendor[]>,
        engine.products.list() as Promise<Product[]>,
      ]);
      setRecords(orders);
      setVendors(vends.filter((v) => v.status === 'active'));
      setProducts(prods.filter((p) => p.status === 'active'));
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openNew = () => {
    setSelected(null);
    setForm({ vendor_id: '', vendor_name: '', order_date: new Date().toISOString().split('T')[0], expected_date: '', currency: 'USD', notes: '', lines: [] });
    setView('form');
  };

  const addLine = () => {
    setForm((f) => ({ ...f, lines: [...f.lines, { id: v4(), product_id: '', product_name: '', quantity: 1, unit_price: 0, total: 0 }] }));
  };

  const updateLine = (id: string, patch: Partial<PurchaseOrderLine>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...patch };
        updated.total = updated.quantity * updated.unit_price;
        return updated;
      }),
    }));
  };

  const removeLine = (id: string) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.id !== id) }));

  const selectProduct = (lineId: string, productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    updateLine(lineId, { product_id: p.id, product_name: p.name, unit_price: p.cost_price });
  };

  const selectVendor = (vendorId: string) => {
    const v = vendors.find((vn) => vn.id === vendorId);
    setForm((f) => ({ ...f, vendor_id: vendorId, vendor_name: v?.name ?? '' }));
  };

  const total = form.lines.reduce((s, l) => s + l.total, 0);

  const handleSave = async (confirm = false) => {
    if (!engine) return;
    setSaving(true);
    try {
      const data = { ...form, total };
      let record: PurchaseOrder;
      if (selected) {
        record = await engine.purchaseOrders.save({ ...selected, ...data, status: confirm ? 'active' : selected.status });
      } else {
        const created = engine.purchaseOrders.create(data);
        if (confirm) created.status = 'active';
        record = await engine.purchaseOrders.save(created);
      }
      setRecords((prev) => selected ? prev.map((r) => (r.id === record.id ? record : r)) : [...prev, record]);
      setView('list');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'reference', label: 'الرقم المرجعي' },
    { key: 'vendor_name', label: 'المورد' },
    { key: 'order_date', label: 'التاريخ' },
    { key: 'total', label: 'الإجمالي', render: (r: PurchaseOrder) => `$${r.total?.toLocaleString() ?? 0}` },
    { key: 'status', label: 'الحالة', render: (r: PurchaseOrder) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
        {r.status === 'active' ? 'نشط' : r.status}
      </span>
    )},
  ];

  if (view === 'form') {
    return (
      <div className="p-6 max-w-4xl" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{selected ? `تعديل ${selected.reference}` : 'أمر شراء جديد'}</h1>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">المورد</label>
              <select value={form.vendor_id} onChange={(e) => selectVendor(e.target.value)} className="input-field">
                <option value="">اختر المورد...</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">تاريخ الطلب</label>
              <input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="field-label">تاريخ الاستلام المتوقع</label>
              <input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="field-label">العملة</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input-field">
                <option value="USD">USD</option><option value="EUR">EUR</option><option value="SAR">SAR</option><option value="AED">AED</option>
              </select>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">بنود الطلب</span>
              <button onClick={addLine} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Plus className="w-3.5 h-3.5" /> إضافة بند</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-2 text-right text-xs text-slate-500">المنتج</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-500">الكمية</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-500">سعر الوحدة</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-500">الإجمالي</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {form.lines.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 text-xs">لم يتم إضافة أي بنود.</td></tr>
                )}
                {form.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-2">
                      <select value={line.product_id} onChange={(e) => selectProduct(line.id, e.target.value)} className="input-field text-xs py-1.5">
                        <option value="">اختر المنتج...</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: +e.target.value })} className="input-field text-xs py-1.5 w-20 text-left" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={line.unit_price} onChange={(e) => updateLine(line.id, { unit_price: +e.target.value })} className="input-field text-xs py-1.5 w-24 text-left" />
                    </td>
                    <td className="px-4 py-2 text-left text-slate-300">${line.total.toFixed(2)}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeLine(line.id)} className="text-slate-600 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
              <div className="text-sm text-white font-bold">الإجمالي: ${total.toFixed(2)}</div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setView('list')} className="btn-secondary">إلغاء</button>
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary"><Save className="w-4 h-4" />حفظ كمسودة</button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary">تأكيد ومزامنة</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <RecordList
        title="أوامر الشراء"
        records={records}
        columns={columns}
        loading={loading}
        onNew={openNew}
        onSelect={(r) => { setSelected(r); setForm({ vendor_id: r.vendor_id, vendor_name: r.vendor_name, order_date: r.order_date, expected_date: r.expected_date, currency: r.currency, notes: r.notes, lines: r.lines }); setView('form'); }}
        onRefresh={loadAll}
      />
    </div>
  );
}
