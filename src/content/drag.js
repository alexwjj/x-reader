export function makeDraggable(host, handles) {
  const win = host.ownerDocument.defaultView;
  handles = Array.isArray(handles) ? handles : [handles];
  let position = null;
  let start = null;
  let suppressClick = false;

  function constrain(left, top) {
    const rect = host.getBoundingClientRect();
    const width = rect.width || Math.min(350, win.innerWidth - 32);
    const visibleHeight = Math.min(240, rect.height || 240);
    return {
      left: Math.max(16, Math.min(left, win.innerWidth - width - 16)),
      top: Math.max(16, Math.min(top, win.innerHeight - visibleHeight - 16))
    };
  }

  function apply() {
    position = constrain(position.left, position.top);
    host.style.left = `${position.left}px`;
    host.style.right = 'auto';
    host.style.top = `${position.top}px`;
    host.style.setProperty('--panel-max-height', `${Math.max(160, win.innerHeight - position.top - 16)}px`);
  }

  function move(event) {
    if (!start || event.pointerId !== start.pointerId) return;
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
    start.moved = true;
    host.dataset.dragging = 'true';
    position = { left: start.left + event.clientX - start.x, top: start.top + event.clientY - start.y };
    apply();
  }

  function finish(event) {
    if (!start) return;
    if (event?.pointerId !== undefined && event.pointerId !== start.pointerId) return;
    const { pointerId, handle, moved } = start;
    suppressClick = moved;
    start = null;
    delete host.dataset.dragging;
    win.removeEventListener('pointermove', move);
    win.removeEventListener('pointerup', finish);
    win.removeEventListener('pointercancel', finish);
    win.removeEventListener('blur', finish);
    if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
  }

  function down(event) {
    const handle = event.currentTarget;
    if (event.button !== 0 || (event.target.closest('button,a,input,select') && event.target.closest('button,a,input,select') !== handle)) return;
    finish();
    suppressClick = false;
    const rect = host.getBoundingClientRect();
    start = { pointerId: event.pointerId, handle, moved: false, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture?.(event.pointerId);
    win.addEventListener('pointermove', move);
    win.addEventListener('pointerup', finish);
    win.addEventListener('pointercancel', finish);
    win.addEventListener('blur', finish);
    if (!handle.matches('button')) event.preventDefault();
  }

  function click(event) {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function keydown(event) {
    if (event.target !== event.currentTarget || (!event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key))) return;
    const step = event.shiftKey ? 30 : 10;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    const rect = host.getBoundingClientRect();
    position = { left: rect.left + delta[0], top: rect.top + delta[1] };
    apply();
    event.preventDefault();
  }

  for (const handle of handles) {
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('keydown', keydown);
    handle.addEventListener('lostpointercapture', finish);
    handle.addEventListener('click', click, true);
  }
  return {
    place({ left, compact, top = win.innerWidth <= 700 ? 76 : 86 }) {
      if (position) { apply(); return; }
      host.style.left = left === null ? 'auto' : `${left}px`;
      host.style.right = left === null ? (compact && win.innerWidth <= 700 ? '16px' : '24px') : 'auto';
      host.style.top = `${top}px`;
      host.style.setProperty('--panel-max-height', `${Math.max(160, win.innerHeight - top - 16)}px`);
    },
    destroy() {
      finish();
      for (const handle of handles) {
        handle.removeEventListener('pointerdown', down);
        handle.removeEventListener('keydown', keydown);
        handle.removeEventListener('lostpointercapture', finish);
        handle.removeEventListener('click', click, true);
      }
    }
  };
}
