// Stand-in for a page's real content: just the design's 56px sheet header
// with the page name, until each page is built from its own design.
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center border-b border-line px-5">
      <h1 className="text-heading font-semibold text-ink">{title}</h1>
    </header>
  );
}
