import { Skeleton } from '@app/Application/Components';

/** Esqueleto del timeline mientras carga la primera página (FR-015). */
export const HistorySkeleton = () => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-4 w-32 rounded-flat" />
    <Skeleton className="h-16 w-full rounded-flat" />
    <Skeleton className="h-16 w-full rounded-flat" />
    <Skeleton className="h-16 w-full rounded-flat" />
  </div>
);
