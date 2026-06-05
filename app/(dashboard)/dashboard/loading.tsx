import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr_0.85fr]">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="gap-0 px-5 py-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-9 w-40" />
            <Skeleton className="mt-4 h-9 w-full" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="px-5 py-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-6 h-64 w-full" />
        </Card>
        <Card className="px-5 py-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-5 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="px-5 py-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-5 h-56 w-full" />
        </Card>
        <Card className="px-5 py-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-5 h-56 w-full" />
        </Card>
      </div>
    </div>
  );
}
