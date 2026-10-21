import { useEffect, useRef, useId, cloneElement, type ReactNode, type ReactElement } from 'react';
import { X, ArrowRight, Plus, Check } from 'lucide-react';
import { statusLabels } from './domain';
export function Badge({ status }: { status: string }) {
  return (
    <span className={'badge ' + status}>
      <i />
      {statusLabels[status] || status}
    </span>
  );
}
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={'avatar ' + (small ? 'small' : '')} title={name}>
      {name
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </span>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <span
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: value + '%' }} />
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
  label = 'Créer',
  icon,
}: {
  title: string;
  description: string;
  action?: () => void;
  label?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <Check size={26} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="primary" onClick={action}>
          <Plus size={16} />
          {label}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  className = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={(wide ? 'wide ' : '') + className}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
