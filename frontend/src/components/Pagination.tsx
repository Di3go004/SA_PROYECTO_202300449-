// src/components/Pagination.tsx
// Controles de página. El backend impone el máximo de 10 por página; acá solo
// se navega sobre el total que él reporta.
interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onChange: (page: number) => void
}

/** Ventana de páginas alrededor de la actual, con elipsis. -1 marca la elipsis. */
function pageWindow(page: number, totalPages: number): number[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, -1, totalPages]
  if (page >= totalPages - 3) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, -1, page - 1, page, page + 1, -1, totalPages]
}

export default function Pagination({ page, totalPages, total, limit, onChange }: PaginationProps) {
  if (total === 0) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className="pagination">
      <span className="pagination-info">
        Mostrando <strong>{from}–{to}</strong> de <strong>{total}</strong> · {limit} por página
      </span>
      <div className="pagination-controls">
        <button className="page-btn" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Anterior">‹</button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === -1
            ? <span key={`gap-${i}`} className="page-ellipsis">…</span>
            : (
              <button
                key={p}
                className={`page-btn${p === page ? ' is-active' : ''}`}
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ),
        )}
        <button className="page-btn" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Siguiente">›</button>
      </div>
    </div>
  )
}
