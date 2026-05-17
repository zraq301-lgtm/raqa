import { useState, useEffect, useCallback } from 'react';
import { useERP } from '../context/erp-engine';
import { Employee } from '../models/manufacturing.model';
import RecordList from '../components/RecordList';
import { BaseRecord } from '../lib/base-model';
import { X, Save } from 'lucide-react';

type View = 'list' | 'form';

const INITIAL: Omit<Employee, keyof BaseRecord> = {
  name: '', employee_number: '', department: '', position: '',
  hire_date: new Date().toISOString().split('T')[0],
  hourly_rate: 0, email: '', phone: '',
};

export default function EmployeesModule() {
  const { engine } = useERP();
  const [view, setView] = useState<View>('list');
  const [records, setRecords] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!engine) return;
    setLoading(true);
    try { setRecords((await engine.employees.list()) as Employee[]); }
    finally { setLoading(false); }
  }, [engine]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const openNew = () => { setSelected(null); setForm(INITIAL); setView('form'); };
  const openEdit = (r: Employee) => { setSelected(r); setForm({ name: r.name, employee_number: r.employee_number, department: r.department, position: r.position, hire_date: r.hire_date, hourly_rate: r.hourly_rate, email: r.email, phone: r.phone }); setView('form'); };

  const handleSave = async () => {
    if (!engine) return;
    setSaving(true);
    try {
      const record = selected
        ? await engine.employees.save({ ...selected, ...form })
        : await engine.employees.save(engine.employees.create(form));
      setRecords((prev) => selected ? prev.map((r) => (r.id === record.id ? record : r)) : [...prev, record]);
      setView('list');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'employee_number', label: 'No.' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'position', label: 'Position' },
    { key: 'hourly_rate', label: 'Hourly Rate', render: (r: Employee) => `$${r.hourly_rate}` },
    { key: 'status', label: 'Status', render: (r: Employee) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{r.status}</span>
    )},
  ];

  if (view === 'form') {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{selected ? 'Edit Employee' : 'New Employee'}</h1>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-2 gap-4">
          {[
            { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Ahmed Al-Rashid' },
            { key: 'employee_number', label: 'Employee No.', type: 'text', placeholder: 'EMP-001' },
            { key: 'department', label: 'Department', type: 'text', placeholder: 'Production' },
            { key: 'position', label: 'Position', type: 'text', placeholder: 'Machine Operator' },
            { key: 'hire_date', label: 'Hire Date', type: 'date', placeholder: '' },
            { key: 'hourly_rate', label: 'Hourly Rate ($)', type: 'number', placeholder: '0' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'ahmed@company.com' },
            { key: 'phone', label: 'Phone', type: 'text', placeholder: '+966 5x xxx xxxx' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="field-label">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={String(form[key as keyof typeof form])}
                onChange={(e) => setForm({ ...form, [key]: type === 'number' ? +e.target.value : e.target.value })}
                className="input-field"
              />
            </div>
          ))}
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
      title="Employees"
      records={records}
      columns={columns}
      loading={loading}
      onNew={openNew}
      onSelect={openEdit}
      onRefresh={loadRecords}
    />
  );
}
