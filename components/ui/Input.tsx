import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs text-[#A0A0B0] font-medium uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 bg-[#0F0F13] border rounded-lg text-sm text-[#F0F0F0]
            placeholder:text-[#A0A0B0]/50 font-['Fira_Code',monospace]
            transition-all duration-200
            focus:outline-none focus:border-[#00FF41]/50 focus:shadow-[0_0_15px_rgba(0,255,65,0.1)]
            ${error ? "border-[#FF4444]/50" : "border-white/10 hover:border-white/20"}
            ${className ?? ""}`}
          {...props}
        />
        {error && <p className="text-xs text-[#FF4444]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
