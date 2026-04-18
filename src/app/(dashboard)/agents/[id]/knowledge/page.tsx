export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h2 className="text-lg font-semibold">Knowledge</h2>
      <p className="text-sm text-muted-foreground">
        File upload, chunk browser, and editor land here in Phase 2.
      </p>
    </div>
  );
}
