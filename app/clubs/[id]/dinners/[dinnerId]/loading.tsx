export default function DinnerLoading() {
  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1"><div className="w-4 h-6 bg-white/20 rounded animate-pulse" /></div>
        <div className="w-24 h-5 bg-white/20 rounded-lg animate-pulse" />
        <div className="flex-1 flex justify-end"><div className="w-8 h-8 bg-white/20 rounded-full animate-pulse" /></div>
      </nav>
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="animate-pulse flex flex-col gap-2">
          <div className="h-5 w-28 bg-black/10 rounded-full" />
          <div className="h-8 w-48 bg-black/10 rounded" />
        </div>
        <div className="bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 bg-black/10 rounded-xl shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-4 w-40 bg-black/10 rounded" />
                <div className="h-3 w-24 bg-black/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
