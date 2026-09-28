import type { ReactNode } from 'react';

export function CatalogSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="catalog-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}
export function SpecTable({
  headings,
  rows,
}: {
  headings?: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <div className="catalog-table-scroll">
      <table className="catalog-table">
        {headings && (
          <thead>
            <tr>
              {headings.map(heading => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={i}>{cell}</td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Demo({
  title,
  spec,
  children,
  wide = false,
  canvas = false,
}: {
  title: string;
  spec: string;
  children: ReactNode;
  wide?: boolean;
  canvas?: boolean;
}) {
  return (
    <article className={`catalog-demo${wide ? ' catalog-demo--wide' : ''}`}>
      <header>
        <h4>{title}</h4>
        <p>{spec}</p>
      </header>
      <div
        className={`catalog-demo-stage cameo-light${canvas ? ' catalog-demo-stage--canvas' : ''}`}
      >
        {children}
      </div>
    </article>
  );
}
