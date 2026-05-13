import { redirect } from "next/navigation";

export default async function ProjectIndexPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/loteria/${projectId}/deck`);
}
