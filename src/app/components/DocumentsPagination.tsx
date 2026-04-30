import { ChevronLeft, ChevronRight } from 'lucide-react';

type PageItem = number | 'start-ellipsis' | 'end-ellipsis';

interface DocumentsPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function paginationItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
  }

  const sortedPages = [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);
  const items: PageItem[] = [];

  sortedPages.forEach((item, index) => {
    const previous = sortedPages[index - 1];
    if (previous && item - previous > 1) {
      items.push(index === 1 ? 'start-ellipsis' : 'end-ellipsis');
    }
    items.push(item);
  });

  return items;
}

export function DocumentsPagination({ page, totalPages, onPageChange }: DocumentsPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-2 mb-8" aria-label="Paginacao de documentos">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-300 dark:hover:border-blue-500"
        aria-label="Página anterior"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {paginationItems(page, totalPages).map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={`h-10 min-w-10 px-3 inline-flex items-center justify-center rounded-xl border transition-colors ${
              item === page
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500'
            }`}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="px-1 text-slate-400 dark:text-slate-500">
            ...
          </span>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-300 dark:hover:border-blue-500"
        aria-label="Proxima pagina"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </nav>
  );
}
