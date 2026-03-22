export default function DiscoverLoading() {
  return (
    <main className="min-h-screen bg-snow">
      <nav className="bg-slate px-6 py-4 flex items-center">
        <div className="flex-1"><div className="w-4 h-6 bg-white/20 rounded animate-pulse" /></div>
        <div className="w-20 h-5 bg-white/20 rounded-lg animate-pulse" />
        <div className="flex-1 flex justify-end"><div className="w-8 h-8 bg-white/20 rounded-full animate-pulse" /></div>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-4">
        <div className="flex items-center justify-between mb-2 animate-pulse">
          <div className="h-8 w-32 bg-black/10 rounded" />
          <div className="h-5 w-16 bg-black/10 rounded-full" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-black/8 rounded-2xl p-5 flex flex-col gap-4 animate-pulse">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <div className="h-6 w-40 bg-black/10 rounded" />
                <div className="h-4 w-56 bg-black/5 rounded" />
              </div>
              <div className="h-6 w-12 bg-black/10 rounded shrink-0" />
            </div>
            <div className="flex gap-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex flex-col gap-1">
                  <div className="h-3 w-10 bg-black/5 rounded" />
                  <div className="h-4 w-8 bg-black/10 rounded" />
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-black/5 flex justify-between">
              <div className="h-3 w-24 bg-black/5 rounded" />
              <div className="h-3 w-16 bg-black/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
