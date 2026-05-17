import { HTMLAttributes, forwardRef } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  glow?: "green" | "cyan" | "purple" | "none";
}

const glowClasses: Record<string, string> = {
  green: "shadow-[0_0_30px_rgba(0,255,65,0.1)]",
  cyan: "shadow-[0_0_30px_rgba(0,240,255,0.1)]",
  purple: "shadow-[0_0_30px_rgba(180,77,255,0.1)]",
  none: "",
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ glow = "none", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`glass-panel ${glowClasses[glow]} ${className ?? ""}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";
