'use client';

import { useCallback, useEffect, useState } from 'react';
import { approveVehicle, getAdminVehicles, type AdminVehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const TIPO_LABELS: Record<string, string> = {
  auto: 'Auto',
  moto: 'Moto',
  camioneta: 'Camioneta',
};

export default function ApprovalsPage() {
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [showApproved, setShowApproved] = useState(false);
  const [approved, setApproved] = useState<AdminVehicle[]>([]);
  const [loadingApproved, setLoadingApproved] = useState(false);

  const fetchPending = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAdminVehicles(token, false);
      setVehicles(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchApproved = useCallback(async () => {
    if (!token) return;
    setLoadingApproved(true);
    try {
      const data = await getAdminVehicles(token, true);
      setApproved(data);
    } catch {
      // ignore
    } finally {
      setLoadingApproved(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (showApproved) fetchApproved();
  }, [showApproved, fetchApproved]);

  async function handleApprove(id: number) {
    if (!token) return;
    setApprovingId(id);
    try {
      await approveVehicle(token, id);
      await fetchPending();
    } catch {
      // ignore
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold" data-testid="approvals-heading">
        Aprobación de vehículos
      </h1>

      <section className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Pendientes de aprobación
        </h2>

        {loading ? (
          <div className="space-y-3" data-testid="pending-loading">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"
            data-testid="pending-empty"
          >
            <p className="text-slate-500">No hay vehículos pendientes de aprobación.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-sm" data-testid="pending-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  {['Placa', 'Tipo', 'Propietario', 'Correo', 'Registrado', 'Acción'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    data-testid={`pending-row-${v.id}`}
                  >
                    <td className="px-4 py-3 font-mono font-semibold tracking-wider">{v.plate}</td>
                    <td className="px-4 py-3">{TIPO_LABELS[v.vehicle_type] ?? v.vehicle_type}</td>
                    <td className="px-4 py-3">{v.user.full_name}</td>
                    <td className="px-4 py-3 text-slate-500">{v.user.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(v.created_at).toLocaleDateString('es-GT')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleApprove(v.id)}
                        disabled={approvingId === v.id}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        data-testid="approve-btn"
                      >
                        {approvingId === v.id ? 'Aprobando…' : 'Aprobar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <button
          onClick={() => setShowApproved((v) => !v)}
          className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2"
          data-testid="toggle-approved-btn"
        >
          {showApproved ? 'Ocultar vehículos aprobados' : 'Ver vehículos aprobados'}
        </button>

        {showApproved && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-sm" data-testid="approved-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  {['Placa', 'Tipo', 'Propietario', 'Correo'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-slate-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingApproved ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-slate-400"
                      data-testid="approved-loading"
                    >
                      Cargando…
                    </td>
                  </tr>
                ) : approved.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-slate-400"
                      data-testid="approved-empty"
                    >
                      Sin vehículos aprobados.
                    </td>
                  </tr>
                ) : (
                  approved.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-slate-100 last:border-0"
                      data-testid={`approved-row-${v.id}`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold tracking-wider">{v.plate}</td>
                      <td className="px-4 py-3">{TIPO_LABELS[v.vehicle_type] ?? v.vehicle_type}</td>
                      <td className="px-4 py-3">{v.user.full_name}</td>
                      <td className="px-4 py-3 text-slate-500">{v.user.email}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}