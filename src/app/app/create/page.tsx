import { db } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { CreateStudio } from "@/components/create-studio";
import { videoProvider } from "@/server/ai/registry";

export default async function CreatePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { workspace } = await requireContext();
  const [products, creators, brandKit] = await Promise.all([
    db.product.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, imageUrl: true, analysisStatus: true } }),
    db.creator.findMany({ where: { OR: [{ workspaceId: null }, { workspaceId: workspace.id }], status: "active" }, orderBy: [{ isBrandCreator: "desc" }, { createdAt: "asc" }] }),
    db.brandKit.findUnique({ where: { workspaceId: workspace.id } }),
  ]);
  return (
    <CreateStudio
      products={products}
      creators={creators.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      credits={workspace.creditBalance}
      videoDurations={videoProvider().durationOptions}
      brandName={brandKit?.brandName || workspace.name}
      initial={{
        productId: sp.product,
        creatorId: sp.creator,
        kind: sp.kind === "video" ? "video" : sp.kind === "photo" ? "photo" : undefined,
        presetId: sp.preset,
        count: sp.count ? Number(sp.count) : undefined,
        sourceCreativeId: sp.from,
      }}
    />
  );
}
