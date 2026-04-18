export default async function ConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h2 className="text-lg font-semibold">Config</h2>
      <p className="text-sm text-muted-foreground">
        Tone, response length, goal, pushiness, confidence threshold — Phase 5.
      </p>
    </div>
  );
}
