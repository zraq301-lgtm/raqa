import { useState, useEffect, useCallback } from 'react';
import { useERP } from '../context/erp-engine';
import { SalesOrder, SalesOrderLine } from '../models/sales.model';
import { Customer } from '../models/sales.model';
import { Product } from '../models/inventory.model';
import RecordList from '../components/RecordList';
import { BaseRecord } from '../lib/base-model';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { v4 } from '../lib/uuid';

type View = 'list' | 'form';

export default function SalesModule() {
  const { engine } = useERP();
  const [view, setView] = useState<View>('list');
  const [records, setRecords] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer_id: '',
    customer_name: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    currency: 'USD',
    warehouse_id: '',
    notes: '',
    lines: [] as SalesOrderLine[],
  });

  const loadAll = useCallback(async () => {
    if (!engine) return;
    setLoading(true);
    try {
      const [orders, custs, prods] = await Promise.all([
        engine.salesOrders.list() as Promise<SalesOrder[]>,
        engine.customers.list() as Promise<Customer[]>,
        engine.products.list() as Promise<Product[]>,
      ]);
      setRecords(orders);
      setCustomers(custs.filter((c) => c.status === 'active'));
      setProducts(prods.filter((p) => p.status === 'active'));
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openNew = () => {
    setSelected(null);
    setForm({
      customer_id: '',
      customer_name: '',
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: '',
      currency: 'USD',
      warehouse_id: '',
      notes: '',
      lines: [],
    });
    setView('form');
  };

  const openEdit = (record: SalesOrder) => {
    setSelected(record);
    setForm({
      customer_id: record.customer_id,
      customer_name: record.customer_name,
      order_date: record.order_date,
      delivery_date: record.delivery_date,
      currency: record.currency,
      warehouse_id: record.warehouse_id,
      notes: record.notes,
      lines: record.lines,
    });
    setView('form');
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { id: v4(), product_id: '', product_name: '', quantity: 1, unit_price: 0, discount: 0, total: 0 }],
    }));
  };

  const updateLine = (id: string, patch: Partial<SalesOrderLine>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...patch };
        updated.total = updated.quantity * updated.unit_price * (1 - updated.discount / 100);
        return updated;
      }),
    }));
  };

  const removeLine = (id: string) => {
    setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.id !== id) }));
  };

  const selectProduct = (lineId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    updateLine(lineId, { product_id: product.id, product_name: product.name, unit_price: product.sale_price });
  };

  const selectCustomer = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    setForm((f) => ({
      ...f,
      customer_id: customerId,
      customer_name: customer?.name ?? '',
    }));
  };

  const totals = engine?.salesOrders.computeTotals(form.lines) ?? { subtotal: 0, tax_amount: 0, total: 0 };

  const handleSave = async (confirm = false) => {
    if (!engine) return;
    setSaving(true);
    try {
      const orderData = {
        ...form,
        ...totals,
        invoice_id: '',
      };
      let record: SalesOrder;
      if (selected) {
        record = await engine.salesOrders.save({
          ...selected,
          ...orderData,
          status: confirm ? 'active' : selected.status,
        });
      } else {
        const created = engine.salesOrders.create(orderData);
        if (confirm) created.status = 'active';
        record = await engine.salesOrders.save(created);
      }
      setRecords((prev) =>
        selected ? prev.map((r) => (r.id === record.id ? record : r)) : [...prev, record]
      );
      setView('list');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'reference', label: 'Reference' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'order_date', label: 'Date' },
    {
      key: 'total',
      label: 'Total',
      render: (r: SalesOrder) => `$${r.total?.toLocaleString() ?? 0}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: SalesOrder) => (
        <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-emerald-950 text-emerald-400' : r.status === 'draft' ? 'bg-slate-800 text-slate-400' : 'bg-rose-950 text-rose-400'}`}>
          {r.status}
        </span>
      ),
    },
  ];

  if (view === 'form') {
    return (
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">
            {selected ? `Edit ${selected.reference}` : 'New Sales Order'}
          </h1>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Customer</label>
              <select
                value={form.customer_id}
                onChange={(e) => selectCustomer(e.target.value)}
                className="input-field"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Order Date</label>
              <input
                type="date"
                value={form.order_date}
                onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="field-label">Delivery Date</label>
              <input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="field-label">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="input-field"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="SAR">SAR</option>
                <option value="AED">AED</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="field-label">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Lines */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Order Lines</span>
              <button onClick={addLine} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-2 text-left text-xs text-slate-500">Product</th>
                    <th className="px-4 py-2 text-right text-xs text-slate-500">Qty</th>
                    <th className="px-4 py-2 text-right text-xs text-slate-500">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs text-slate-500">Disc %</th>
                    <th className="px-4 py-2 text-right text-xs text-slate-500">Total</th>
                    <th className="px-2 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {form.lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-xs">
                        No lines. Click "Add Line" above.
                      </td>
                    </tr>
                  )}
                  {form.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2">
                        <select
                          value={line.product_id}
                          onChange={(e) => selectProduct(line.id, e.target.value)}
                          className="input-field text-xs py-1.5"
                        >
                          <option value="">Select product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, { quantity: +e.target.value })}
                          className="input-field text-xs py-1.5 w-20 text-right"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => updateLine(line.id, { unit_price: +e.target.value })}
                          className="input-field text-xs py-1.5 w-24 text-right"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={line.discount}
                          onChange={(e) => updateLine(line.id, { discount: +e.target.value })}
                          className="input-field text-xs py-1.5 w-16 text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">
                        ${line.total.toFixed(2)}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeLine(line.id)} className="text-slate-600 hover:text-red-400 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Totals */}
            <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
              <div className="text-sm space-y-1 min-w-[200px]">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax (15%)</span>
                  <span>${totals.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-slate-700 pt-1">
                  <span>Total</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button onClick={() => setView('list')} className="btn-secondary">Cancel</button>
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary">
              <Save className="w-4 h-4" />
              Save Draft
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary">
              Confirm & Sync
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RecordList
      title="Sales Orders"
      records={records}
      columns={columns}
      loading={loading}
      onNew={openNew}
      onSelect={openEdit}
      onRefresh={loadAll}
    />
  );
}
