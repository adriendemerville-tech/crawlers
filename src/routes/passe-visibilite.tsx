import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/passe-visibilite')({
  beforeLoad: () => {
    throw redirect({
      to: '/audit-geo-seo',
      statusCode: 301,
      replace: true,
    });
  },
  component: () => null,
});
