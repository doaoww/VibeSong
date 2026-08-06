export default function Star({
  className = "",
  color = "var(--color-hot-pink)",
  style,
}: {
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={color}
      style={style}
      aria-hidden
    >
      <path d="M12 0 L14 9 L24 12 L14 15 L12 24 L10 15 L0 12 L10 9 Z" />
    </svg>
  );
}
