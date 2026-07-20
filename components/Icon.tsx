import { ICON_CODEPOINTS, type IconName } from "../lib/materialIconCodepoints";

export default function Icon({
  name,
  className,
  style,
}: {
  name: IconName;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined${className ? ` ${className}` : ""}`}
      style={style}
      aria-hidden="true"
    >
      {ICON_CODEPOINTS[name]}
    </span>
  );
}
