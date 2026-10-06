import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { imageProvider } from "@/server/ai/registry";
import { photoCost } from "@/lib/catalog";
import { CreatorIdentityStudio } from "@/components/creator-identity-studio";

export default async function CreatorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ generate?: string }> }) {
  const { id } = await params;
  const { generate } = await searchParams;
  const { workspace } = await requireContext();
  const creator = await db.creator.findFirst({ where: { id, OR: [{ workspaceId: workspace.id }, { workspaceId: null }] }, select: { id: true } });
  if (!creator) notFound();
  return (
    <CreatorIdentityStudio
      creatorId={id}
      autoGenerate={generate === "1"}
      previewMode={imageProvider().name === "mock"}
      creditPerImage={photoCost("standard")}
    />
  );
}
