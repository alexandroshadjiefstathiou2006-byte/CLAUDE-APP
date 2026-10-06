import { db } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { PageHeader } from "@/components/ui";
import { CreatorLibrary } from "@/components/creator-library";

export default async function CreatorsPage() {
  const { workspace } = await requireContext();
  const creators = await db.creator.findMany({
    where: { OR: [{ workspaceId: null }, { workspaceId: workspace.id }] },
    orderBy: [{ isBrandCreator: "desc" }, { createdAt: "asc" }],
  });
  return (
    <>
      <PageHeader title="AI Creators" subtitle="Consistent AI models and UGC creators to feature your products. Create your own brand creator to reuse across every campaign." />
      <CreatorLibrary creators={creators.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))} />
    </>
  );
}
