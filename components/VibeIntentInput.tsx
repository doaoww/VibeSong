"use client";

interface VibeIntentInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export default function VibeIntentInput({ value, onChange, placeholder }: VibeIntentInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={120}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full bg-surface-container-low/50 border border-outline-variant/20 rounded-xl px-4 py-3.5 text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-hot-pink transition-colors text-sm"
    />
  );
}
