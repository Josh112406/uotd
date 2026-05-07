import Link from "next/link";

interface ComingSoonProps {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
}

export default function ComingSoon({
  emoji,
  title,
  subtitle,
  description,
}: ComingSoonProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
      <span className="text-6xl mb-6 select-none" aria-hidden="true">{emoji}</span>
      <p className="text-xs font-body font-semibold tracking-widest text-brand-rust uppercase mb-2">
        Paparating na
      </p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-brand-bark mb-3">
        {title}
      </h1>
      <p className="text-base font-body text-brand-smoke max-w-sm mb-2">
        {subtitle}
      </p>
      <p className="text-sm font-body text-brand-smoke/70 max-w-xs mb-8">
        {description}
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-brand-rust hover:bg-brand-silog text-white font-body font-semibold text-sm rounded-full transition-all active:scale-95"
      >
        ← Bumalik sa Home
      </Link>
    </div>
  );
}
