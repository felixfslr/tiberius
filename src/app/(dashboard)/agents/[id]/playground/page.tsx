export default async function PlaygroundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h2 className="text-lg font-semibold">Playground</h2>
      <p className="text-sm text-muted-foreground">
        Chat + debug panel arrive in Phase 4.
      </p>
    </div>
  );
}
