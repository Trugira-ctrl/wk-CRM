export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter text-zinc-900 mb-2">404 - Not Found</h1>
        <p className="text-zinc-500">The page you are looking for does not exist.</p>
        <a href="/" className="mt-6 inline-block font-bold uppercase tracking-widest text-xs text-zinc-900 border border-zinc-900 px-6 py-3 hover:bg-zinc-900 hover:text-white transition-colors">
          Return Home
        </a>
      </div>
    </div>
  );
}
