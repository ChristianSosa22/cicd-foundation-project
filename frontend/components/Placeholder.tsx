export function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
        Pantalla en construcción
      </div>
    </main>
  );
}
