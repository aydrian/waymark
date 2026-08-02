export function showToast(message: string, type: 'success' | 'error' | 'warn' = 'success'): void {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const colorClass =
    type === 'success' ? 'bg-green-600 text-white' :
    type === 'error'   ? 'bg-red-600 text-white'   :
                         'bg-amber-600 text-white';

  const toast = document.createElement('div');
  toast.className = `${colorClass} text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-auto transition-opacity duration-300 max-w-sm text-center`;
  toast.textContent = message;
  container.appendChild(toast);

  const duration = type === 'success' ? 3000 : 5000;
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
