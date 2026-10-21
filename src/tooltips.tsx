import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
export function ActionTooltips() {
  const id = useId(),
    [active, setActive] = useState<{
      element: HTMLElement;
      label: string;
      x: number;
      y: number;
      above: boolean;
    } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
      clearTimeout(timer);
      setActive(null);
    };
    function target(event: Event) {
      const node = event.target;
      if (!(node instanceof Element)) return null;
      const el = node.closest<HTMLElement>('button[aria-label],a[aria-label]');
      return el && el.querySelector('svg') ? el : null;
    }
    function show(element: HTMLElement) {
      if (!element.isConnected) return;
      const rect = element.getBoundingClientRect(),
        above = rect.bottom > innerHeight - 70;
      setActive({
        element,
        label: element.getAttribute('aria-label') || '',
        x: Math.max(120, Math.min(innerWidth - 120, rect.left + rect.width / 2)),
        y: above ? rect.top - 8 : rect.bottom + 8,
        above,
      });
    }
    function enter(event: Event) {
      const el = target(event);
      if (!el) return;
      clearTimeout(timer);
      timer = setTimeout(() => show(el), event.type === 'focusin' ? 0 : 300);
    }
    function leave(event: Event) {
      const el = target(event);
      const next = (event as MouseEvent).relatedTarget;
      if (el && next instanceof Node && el.contains(next)) return;
      hide();
    }
    document.addEventListener('pointerover', enter);
    document.addEventListener('focusin', enter);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('keydown', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', enter);
      document.removeEventListener('focusin', enter);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('scroll', hide, true);
      document.removeEventListener('keydown', hide);
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const previous = active.element.getAttribute('aria-describedby');
    active.element.setAttribute('aria-describedby', [previous, id].filter(Boolean).join(' '));
    return () => {
      if (previous) active.element.setAttribute('aria-describedby', previous);
      else active.element.removeAttribute('aria-describedby');
    };
  }, [active, id]);
  return active && active.element.isConnected
    ? createPortal(
        <div
          id={id}
          role="tooltip"
          className={'action-tooltip ' + (active.above ? 'above' : '')}
          style={{ left: active.x, top: active.y }}
        >
          {active.label}
        </div>,
        active.element.closest('dialog') || document.body,
      )
    : null;
}
