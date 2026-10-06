import { db } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { PageHeader, ButtonLink } from "@/components/ui";
import { CreativeLibrary } from "@/components/creative-library";
import { Sparkles } from "lucide-react";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ open?: string; filter?: string }> }) {
  const sp = await searchParams;
  const { workspace } = await requireContext();
  const creatives = await db.creative.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { product: { select: { id: true, name: true } }, creator: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return (
    <>
      <PageHeader
        title="Creative Library"
        subtitle="Every photo and video you generate is saved here, ready to download and publish."
        actions={<ButtonLink href="/app/create" variant="brand"><Sparkles className="h-4 w-4" /> Create Content</ButtonLink>}
      />
      <CreativeLibrary
        creatives={creatives.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
        openId={sp.open}
        initialFilter={sp.filter}
      />
    </>
  );
}
