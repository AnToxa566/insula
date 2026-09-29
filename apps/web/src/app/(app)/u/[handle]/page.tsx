import { PagePlaceholder } from '../../_components/page-placeholder';

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  // The handle comes from the URL, so it's untrusted text — React escapes it.
  return <PagePlaceholder title={`@${handle}`} />;
}
