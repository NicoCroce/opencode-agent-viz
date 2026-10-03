import { Container, Skeleton } from '@app/Application/Components';

export const InspectorSkeleton = () => (
  <Container space="medium" className="p-4">
    <Skeleton className="h-5 w-40 rounded-flat" />
    <Skeleton className="h-4 w-56 rounded-flat" />
    <Skeleton className="h-24 w-full rounded-flat" />
    <Skeleton className="h-24 w-full rounded-flat" />
  </Container>
);
