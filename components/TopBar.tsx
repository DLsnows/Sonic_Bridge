"use client";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-[#00FF41]/10 bg-[#09090B]/80 backdrop-blur-lg sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-['Share_Tech_Mono',monospace] text-[#F0F0F0]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-[#A0A0B0] mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
