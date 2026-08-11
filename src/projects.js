export const categories = ['UX/UI', 'Graphic', 'Video'];

export const projectCatalog = {
  'UX/UI': [],
  Graphic: [],
  Video: [],
};

export function getProjects(category) {
  return [...(projectCatalog[category] ?? [])].sort(
    (first, second) => new Date(second.publishedAt) - new Date(first.publishedAt),
  );
}
