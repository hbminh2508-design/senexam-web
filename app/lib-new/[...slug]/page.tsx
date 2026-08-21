import LibraryNewClient from '../LibraryNewClient'

type RouteParams = { slug: string[] }

export default async function LibNewNestedPage({ params }: { params: Promise<RouteParams> }) {
  const resolved = await params
  return <LibraryNewClient slugSegments={resolved.slug || []} />
}
