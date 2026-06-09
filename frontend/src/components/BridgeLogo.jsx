/** AV Bridge brand mark — launcher / header / loading */
export function BridgeLogo({
  size = 40,
  className = "",
  style = {},
  alt = "AV Bridge",
}) {
  return (
    <img
      src="/512-512.png"
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ display: "block", objectFit: "contain", ...style }}
      draggable={false}
    />
  );
}
