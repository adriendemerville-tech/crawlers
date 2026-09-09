/**
 * Génère un BreadcrumbList conforme à Schema.org / Google.
 * Chaque item est un objet Thing avec un @id et un name,
 * ce qui évite l'alerte "Unnamed item" dans Search Console.
 */
export function breadcrumbList(
  items: Array<{ name: string; url: string }>,
): {
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: { '@type': 'Thing'; '@id': string; name: string };
  }>;
} {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: { '@type': 'Thing', '@id': item.url, name: item.name },
    })),
  };
}
