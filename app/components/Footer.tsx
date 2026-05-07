export default function Footer() {
  return (
    <footer className="border-t border-brand-rice bg-brand-cream mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="font-display text-lg font-bold text-brand-bark">UOTD</p>
        <p className="text-sm font-body text-brand-smoke text-center">
          Ulam Of The Day —{" "}
          <span className="text-brand-rust font-medium">PH</span>
        </p>
        <p className="text-xs font-body text-brand-smoke/60">
          © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
