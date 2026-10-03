import { Container, Skeleton } from '@app/Application/Components';

export const SessionListSkeleton = () => (
  <Container space="small">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-14 w-full rounded-flat" />
    ))}
  </Container>
);
