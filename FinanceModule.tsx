import { useState, useEffect, useCallback } from 'react';
import { useERP } from '../context/erp-engine';
import { LedgerEntry, Expense } from '../models/finance.model';
import { X, Save, DollarSign, BookOpen } from 'lucide-react';

type Tab = 'ledger' | 'expenses';

export default function FinanceModule() {
  const { engine } = useERP();
  const [tab, setTab] = useState<Tab>('ledger');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expForm, setExpForm] = useState({
    category: '',
    description: '',
    amount: 0,
    currency: 'USD',
    expense_date: new Date().toISOString().split('T')[0],
    employee_id: '',
    approved_by: '',
    receipt_url: '',
  });

  const loadAll = useCallback(async () => {
    if (!engine) return;
    setLoading(true);
    try {
      const [led, exp] = await Promise.all([
        engine.ledger.list() as Promise<LedgerEntry[]>,
        engine.expenses.list() as Promise<Expense[]>,
      ]);
      setLedger(led.filter((e) => e.status === 'active'));
      setExpenses(exp.filter((e) => e.status !== 'archived'));
    } finally {
      setLoading(false);
    }
  }, [engine]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSaveExpense = async () => {
    if (!engine) return;
    setSaving(true);
    try {
      const created = engine.expenses.create(expForm);
      created.status = 'active';
      const saved = await engine.expenses.save(created);
      setExpenses((prev) => [...prev, saved]);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const totalRevenue = ledger.filter((e) => e.credit_account === 'sales_revenue').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.filter((e) => e.status === 'active').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Finance</h1>
        {tab === 'expenses' && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm"><DollarSign className="w-4 h-4" />New Expense</button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-emerald-400">${totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total Expenses</div>
          <div className="text-2xl font-bold text-rose-400">${totalExpenses.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Net Profit</div>
          <div className={`text-2xl font-bold ${totalRevenue - totalExpenses >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            ${(totalRevenue - totalExpenses).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit">
        {(['ledger', 'expenses'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'ledger' ? 'General Ledger' : 'Expenses'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm py-8 text-center">Loading...</div>
      ) : tab === 'ledger' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-white">Ledger Entries ({ledger.length})</span>
          </div>
          {ledger.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">No ledger entries. Confirm sales orders to generate entries automatically.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Date', 'Reference', 'Description', 'Debit Account', 'Credit Account', 'Amount'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ledger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800 transition">
                    <td className="px-4 py-3 text-slate-400 text-xs">{entry.entry_date}</td>
                    <td className="px-4 py-3 text-slate-300">{entry.reference}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{entry.description}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{entry.debit_account}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{entry.credit_account}</td>
                    <td className="px-4 py-3 text-white font-medium">${entry.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {expenses.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">No expenses recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Date', 'Reference', 'Category', 'Description', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800 transition">
                    <td className="px-4 py-3 text-slate-400 text-xs">{exp.expense_date}</td>
                    <td className="px-4 py-3 text-slate-300">{exp.reference}</td>
                    <td className="px-4 py-3 text-slate-300">{exp.category}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{exp.description}</td>
                    <td className="px-4 py-3 text-white font-medium">${exp.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${exp.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{exp.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Expense Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold">New Expense</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Office Supplies' },
                { key: 'description', label: 'Description', type: 'text', placeholder: 'Brief description' },
                { key: 'amount', label: 'Amount ($)', type: 'number', placeholder: '0' },
                { key: 'expense_date', label: 'Date', type: 'date', placeholder: '' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="field-label">{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={String(expForm[key as keyof typeof expForm])}
                    onChange={(e) => setExpForm({ ...expForm, [key]: type === 'number' ? +e.target.value : e.target.value })}
                    className="input-field"
                  />
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSaveExpense} disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Expense'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
