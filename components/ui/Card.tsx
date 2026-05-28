import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: "green" | "cyan" | "purple" | "orange" | "none";
  hover?: boolean;
}

const glowClasses: Record<string, string> = {
  green: "hover:shadow-[0_0_30px_rgba(0,255,65,0.15)] hover:border-[#00FF41]/30",
  cyan: "hover:shadow-[0_0_30px_rgba(0,240,255,0.15)] hover:border-[#00F0FF]/30",
  purple: "hover:shadow-[0_0_30px_rgba(180,77,255,0.15)] hover:border-[#B44DFF]/30",
  orange: "hover:shadow-[0_0_30px_rgba(255,140,0,0.15)] hover:border-[#FF8C00]/30",
  none: "",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ glow = "none", hover = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`glass-panel p-4 ${hover ? `transition-all duration-200 cursor-pointer ${glowClasses[glow]}` : ""} ${className ?? ""}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
