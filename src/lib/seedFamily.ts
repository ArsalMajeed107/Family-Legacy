import { apiFetch, notifyDataChanged } from './apiClient.ts';

export const FOUNDING_ASSETS = {
  heroTree: '/src/assets/images/hero_heritage_tree_1795008099859.jpg',
  grandfather: '/src/assets/images/portrait_grandfather_1795008100818.jpg',
  grandmother: '/src/assets/images/portrait_grandmother_1795008101922.jpg',
  ancestralHome: '/src/assets/images/gallery_ancestral_home_1795008101426.jpg',
  heirloomChronicle: '/src/assets/images/gallery_heirloom_chronicle_1795008101618.jpg',
  developer: '/assets/aistudio/arsal_pic_a1e52d81.jpeg',
};

export async function syncPublicOverview(): Promise<void> {
  notifyDataChanged();
}

export async function initializeFoundingLineage(): Promise<{ created: boolean }> {
  const res = await apiFetch<{ ok: boolean; created: boolean }>('/api/seed/sync', {
    method: 'POST',
  });
  notifyDataChanged();
  return { created: Boolean(res.created) };
}
