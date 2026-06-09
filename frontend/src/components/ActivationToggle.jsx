export function ActivationToggle({ active, onChange, title, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      title={title ?? (active ? 'Deactivate rule' : 'Activate rule')}
      onClick={() => onChange(!active)}
      className={`activation-toggle ${active ? 'activation-toggle--on' : ''} ${className}`}
    >
      <span className="activation-toggle__thumb" />
    </button>
  );
}
