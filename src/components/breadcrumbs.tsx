import Link from "next/link";
export type BreadcrumbItem = { label: string; href?: string };
export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav className="breadcrumbs" aria-label="Navegação estrutural">{items.map((item, index) => <span className="breadcrumb-item" key={`${item.label}-${index}`}>{index > 0 && <span className="breadcrumb-separator" aria-hidden="true">/</span>}{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>;
}
