export const folderName = (directory: string | null | undefined): string => {
  if (!directory) return 'Sin carpeta';
  const normalized = directory.replace(/[/\\]+$/, '');
  const parts = normalized.split(/[/\\]/);
  return parts[parts.length - 1] || normalized || directory;
};
