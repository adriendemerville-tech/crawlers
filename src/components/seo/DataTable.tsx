/**
 * Tableau de données lisible par les robots et les moteurs génératifs.
 * Rendu côté serveur, sans script : caption + thead/tbody sémantiques.
 */
export interface DataTableProps {
  caption: string;
  columns: string[];
  rows: string[][];
  className?: string;
}

export function DataTable({ caption, columns, rows, className }: DataTableProps) {
  return (
    <figure className={`not-prose my-8 ${className ?? ''}`}>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-card/60">
              {columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="border-b border-border px-4 py-3 text-left font-semibold text-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="odd:bg-card/20">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-b border-border/60 px-4 py-3 align-top text-foreground/85"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
