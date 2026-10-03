import { Container, Skeleton } from '@app/Application/Components';

export const GraphSkeleton = () => (
  <Container space="medium" className="p-6">
    <Skeleton className="h-20 w-[220px] rounded-flat" />
    <Skeleton className="ml-12 h-20 w-[220px] rounded-flat" />
    <Skeleton className="ml-24 h-20 w-[220px] rounded-flat" />
  </Container>
);
