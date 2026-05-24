import React, { useState } from "react";
import { useAppContext } from "../store/AppContext";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Expense } from "../lib/types";

export default function ExpensesView() {
  const { expenses, addExpense, editExpense, deleteExpense } = useAppContext();

  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<{id: string, name: string} | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    await addExpense({
      date,
      description,
      amount: Number(amount)
    });

    setIsAdding(false);
    setDescription(""); setAmount("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    await editExpense(editingExpense.id, {
      date: editingExpense.date,
      description: editingExpense.description,
      amount: Number(editingExpense.amount)
    });
    setEditingExpense(null);
  };

  const confirmDelete = async () => {
    if (expenseToDelete) {
      await deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Beban Operasional</h1>
        <button onClick={() => setIsAdding(!isAdding)} className="flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition-colors">
          <Plus className="mr-2 h-4 w-4" /> Catat Beban
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Tanggal</label>
              <input required type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Deskripsi (Contoh: Gaji)</label>
              <input required type="text" value={description} onChange={e=>setDescription(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Total Biaya (Rp)</label>
              <input required type="number" min="0" step="any" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Batal</button>
            <button type="submit" className="bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-500 rounded-lg transition-colors">Simpan</button>
          </div>
        </form>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-white">
              <h3 className="text-lg font-bold text-slate-900">Edit Beban</h3>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Tanggal</label>
                  <input required type="date" value={editingExpense.date} onChange={e=>setEditingExpense({...editingExpense, date: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Deskripsi</label>
                  <input required type="text" value={editingExpense.description} onChange={e=>setEditingExpense({...editingExpense, description: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 font-bold mb-1 block">Total Biaya (Rp)</label>
                  <input required type="number" min="0" step="any" value={editingExpense.amount} onChange={e=>setEditingExpense({...editingExpense, amount: Number(e.target.value)})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setEditingExpense(null)} className="px-5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Batal</button>
                <button type="submit" className="bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 rounded-xl transition-colors shadow-sm">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Beban</h3>
            <p className="text-sm text-slate-600 mb-6">
              Apakah Anda yakin ingin menghapus data beban <strong>{expenseToDelete.name}</strong>? Data ini akan hilang selamanya.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setExpenseToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white">
            <h4 className="font-bold text-slate-900">Riwayat Beban</h4>
          </div>
        <table className="min-w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Deskripsi</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total Biaya</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {expenses.map((e) => {
              return (
                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900">{e.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{e.description}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-slate-900">Rp {e.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <button
                      onClick={() => setEditingExpense(e)}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors mr-1"
                      title="Edit Beban"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setExpenseToDelete({id: e.id, name: e.description})}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Hapus Beban"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
