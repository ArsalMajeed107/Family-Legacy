import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, BookOpen, Upload, Plus, Trash2, X } from 'lucide-react';
import { apiFetch, notifyDataChanged } from '../lib/apiClient.ts';
import { compressImageToDataUrl, generateSafeId } from '../lib/genealogy.ts';
import { FOUNDING_ASSETS } from '../lib/seedFamily.ts';
import type { FamilyStory, GalleryItem, UserAccount } from '../types/family.ts';

interface HeritageGalleryProps {
  gallery: GalleryItem[];
  stories: FamilyStory[];
  userProfile: UserAccount | null;
}

export function HeritageGallery({ gallery, stories, userProfile }: HeritageGalleryProps) {
  const [filter, setFilter] = useState<'all' | GalleryItem['category']>('all');
  const [activePhoto, setActivePhoto] = useState<GalleryItem | null>(null);
  const [activeStory, setActiveStory] = useState<FamilyStory | null>(null);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Photo Upload State
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoCategory, setPhotoCategory] = useState<GalleryItem['category']>('historical');
  const [photoYear, setPhotoYear] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [photoPublic, setPhotoPublic] = useState(true);

  // Story Form State
  const [storyTitle, setStoryTitle] = useState('');
  const [storyEra, setStoryEra] = useState('');
  const [storyContent, setStoryContent] = useState('');
  const [storyPublic, setStoryPublic] = useState(true);

  const isAdmin =
    userProfile?.role === 'developer_super_admin' ||
    userProfile?.role === 'family_head' ||
    userProfile?.role === 'branch_admin';

  const isVerifiedMember =
    isAdmin ||
    (userProfile?.role === 'verified_member' && userProfile?.accountStatus === 'active');

  const displayGallery = useMemo(() => {
    const base: GalleryItem[] =
      gallery.length > 0
        ? gallery
        : [
            {
              id: 'preview_courtyard',
              title: 'The Ancestral Courtyard',
              caption:
                'Where generations gathered during seasonal reunions, shared meals, and passed down family traditions.',
              imageUrl: FOUNDING_ASSETS.ancestralHome,
              category: 'historical',
              year: '1978',
              isPublic: true,
              uploadedBy: 'archive',
              createdAt: null,
            },
            {
              id: 'preview_chronicle',
              title: 'The Family Chronicle & Keepsakes',
              caption:
                'Handwritten notebooks, letters, and archival portraits from the era of Muhammad Ghulam & Amna Gulam.',
              imageUrl: FOUNDING_ASSETS.heirloomChronicle,
              category: 'document',
              year: '1984',
              isPublic: true,
              uploadedBy: 'archive',
              createdAt: null,
            },
          ];
    if (filter === 'all') return base;
    return base.filter((g) => g.category === filter);
  }, [gallery, filter]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 720, 0.82);
      setPhotoData(compressed);
      setErrMsg(null);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handlePublishPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !photoData) {
      setErrMsg('Please select an image file first.');
      return;
    }
    setBusy(true);
    setErrMsg(null);
    const id = generateSafeId('gal');
    try {
      await apiFetch('/api/gallery', {
        method: 'POST',
        body: JSON.stringify({
          id,
          title: photoTitle.trim(),
          caption: photoCaption.trim(),
          imageUrl: photoData,
          category: photoCategory,
          year: photoYear.trim(),
          isPublic: photoPublic,
        }),
      });
      notifyDataChanged();
      setPhotoTitle('');
      setPhotoCaption('');
      setPhotoYear('');
      setPhotoData('');
      setShowPhotoModal(false);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setBusy(false);
    }
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || storyContent.trim().length < 10) {
      setErrMsg('Story content must be at least 10 characters.');
      return;
    }
    setBusy(true);
    setErrMsg(null);
    const id = generateSafeId('story');
    try {
      await apiFetch('/api/stories', {
        method: 'POST',
        body: JSON.stringify({
          id,
          title: storyTitle.trim(),
          era: storyEra.trim(),
          excerpt: storyContent.trim().slice(0, 220),
          content: storyContent.trim(),
          isPublic: storyPublic,
        }),
      });
      notifyDataChanged();
      setStoryTitle('');
      setStoryEra('');
      setStoryContent('');
      setShowStoryModal(false);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Failed to publish story.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-300/20 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-amber-200">
            Pashtoon Heritage &amp; Archival Collection
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-white mt-1">
            Photographs, Memories &amp; Stories
          </h1>
          <p className="text-sm text-sky-100/85 mt-2 max-w-2xl">
            Historical family photographs, milestone portraits, and written chronicles preserving the
            journey of Muhammad Ghulam, Amna Gulam, and every generation after.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Photograph</span>
            </button>
          )}
          {isVerifiedMember && (
            <button
              type="button"
              onClick={() => setShowStoryModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sky-300/30 bg-white/5 hover:bg-white/10 text-white font-medium text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-sky-300" />
              <span>Share Family Story</span>
            </button>
          )}
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-sky-300" />
            <h2 className="font-serif text-2xl font-semibold text-white">Archival Gallery</h2>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#081736] border border-sky-300/25">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'historical', label: 'Historical' },
                { id: 'family_event', label: 'Events' },
                { id: 'portrait', label: 'Portraits' },
                { id: 'document', label: 'Documents' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  filter === f.id
                    ? 'bg-sky-300 text-sky-950'
                    : 'text-sky-100/80 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayGallery.map((item) => (
            <article
              key={item.id}
              className="group rounded-2xl border border-sky-300/20 bg-[#081736]/75 backdrop-blur-xl overflow-hidden flex flex-col"
            >
              <button
                type="button"
                onClick={() => setActivePhoto(item)}
                className="aspect-[4/3] w-full overflow-hidden bg-[#050F26] cursor-pointer block"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
              </button>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-sky-300">
                    <span className="capitalize">{item.category.replace(/_/g, ' ')}</span>
                    {item.year && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.year}</span>
                      </>
                    )}
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-white mt-1">{item.title}</h3>
                  {item.caption && (
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed line-clamp-3">
                      {item.caption}
                    </p>
                  )}
                </div>

                {isAdmin && gallery.some((g) => g.id === item.id) && (
                  <div className="pt-3 mt-3 border-t border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/gallery/${item.id}`, { method: 'DELETE' });
                        notifyDataChanged();
                      }}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-6 pt-4 border-t border-sky-300/20">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-300" />
          <h2 className="font-serif text-2xl font-semibold text-white">Family History &amp; Stories</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(stories.length > 0
            ? stories
            : [
                {
                  id: 'default_story',
                  title: 'From Humble Beginnings to a Living Multigenerational Legacy',
                  era: '1965 – Present',
                  authorName: 'Ghulam Heritage Archive',
                  authorUid: 'archive',
                  excerpt:
                    'How Grandfather Muhammad Ghulam and Grandmother Amna Gulam built a home anchored in integrity, hospitality, and kinship.',
                  content:
                    'Every enduring family begins with two individuals whose quiet perseverance shapes generations yet unborn. Grandfather Muhammad Ghulam and Grandmother Amna Gulam established a household where elders were honored, children were encouraged to learn, and relatives from every branch always found an open door.',
                  isPublic: true,
                  createdAt: null,
                },
              ]
          ).map((story) => (
            <article
              key={story.id}
              className="rounded-2xl border border-sky-300/20 bg-[#081736]/75 backdrop-blur-xl p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-sky-300">
                  <span>{story.era || 'Family Chronicle'}</span>
                  {story.authorName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-sky-200/70">By {story.authorName}</span>
                    </>
                  )}
                </div>
                <h3 className="font-serif text-xl font-semibold text-white mt-1.5">
                  {story.title}
                </h3>
                <p className="text-sm text-sky-100/85 mt-2.5 leading-relaxed">
                  {story.excerpt || story.content.slice(0, 220)}
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-sky-300/15 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveStory(story)}
                  className="text-xs font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
                >
                  Read Full Story →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030A1B]/85 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-3xl w-full rounded-2xl border border-sky-300/25 bg-[#081736] overflow-hidden shadow-2xl">
            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              aria-label="Close photograph"
              className="absolute right-3 top-3 z-10 p-2 rounded-lg bg-[#050F26]/85 text-white hover:text-sky-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.title}
              referrerPolicy="no-referrer"
              className="w-full max-h-[65vh] object-contain bg-[#050F26]"
            />
            <div className="p-6">
              <p className="text-xs text-sky-300 capitalize">
                {activePhoto.category.replace(/_/g, ' ')}
                {activePhoto.year ? ` · ${activePhoto.year}` : ''}
              </p>
              <h3 className="font-serif text-2xl font-semibold text-white mt-1">
                {activePhoto.title}
              </h3>
              {activePhoto.caption && (
                <p className="text-sm text-sky-100/85 mt-2 leading-relaxed">{activePhoto.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030A1B]/85 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl border border-sky-300/25 bg-[#081736] p-6 sm:p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveStory(null)}
              aria-label="Close story"
              className="absolute right-4 top-4 p-2 text-sky-200/70 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="text-xs text-sky-300">{activeStory.era || 'Heritage Narrative'}</p>
            <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-white mt-1">
              {activeStory.title}
            </h3>
            {activeStory.authorName && (
              <p className="text-xs text-sky-200/70 mt-1">Recorded by {activeStory.authorName}</p>
            )}
            <div className="mt-6 pt-5 border-t border-sky-300/15 text-sm text-sky-50/90 leading-loose whitespace-pre-line max-w-prose">
              {activeStory.content}
            </div>
          </div>
        </div>
      )}

      {showPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030A1B]/85 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handlePublishPhoto}
            className="relative w-full max-w-lg rounded-2xl border border-sky-300/25 bg-[#081736] p-6 space-y-4 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowPhotoModal(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-xl font-semibold text-white">
              Add Photograph to Family Gallery
            </h3>
            {errMsg && <p className="text-xs text-rose-300">{errMsg}</p>}
            <div>
              <label className="block text-xs text-slate-300 mb-1">Title</label>
              <input
                type="text"
                required
                value={photoTitle}
                onChange={(e) => setPhotoTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Category</label>
                <select
                  value={photoCategory}
                  onChange={(e) => setPhotoCategory(e.target.value as GalleryItem['category'])}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  <option value="historical">Historical</option>
                  <option value="family_event">Family Event</option>
                  <option value="portrait">Portrait</option>
                  <option value="document">Archival Document</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Year</label>
                <input
                  type="text"
                  value={photoYear}
                  onChange={(e) => setPhotoYear(e.target.value)}
                  placeholder="e.g. 1985"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Select Image</label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={handleFileChange}
                className="w-full text-xs text-sky-100/85 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-sky-300 file:text-sky-950 file:font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Caption</label>
              <textarea
                rows={2}
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-sky-100/80 cursor-pointer">
              <input
                type="checkbox"
                checked={photoPublic}
                onChange={(e) => setPhotoPublic(e.target.checked)}
              />
              <span>Visible in public heritage gallery</span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="px-4 py-2 rounded-xl border border-sky-300/25 text-xs text-sky-100/80 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-sky-300 text-sky-950 font-semibold text-xs cursor-pointer"
              >
                {busy ? 'Uploading...' : 'Publish Photograph'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showStoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030A1B]/85 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handlePublishStory}
            className="relative w-full max-w-lg rounded-2xl border border-sky-300/25 bg-[#081736] p-6 space-y-4 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowStoryModal(false)}
              className="absolute right-4 top-4 p-2 text-sky-200/70 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-xl font-semibold text-white">Share a Family Story</h3>
            {errMsg && <p className="text-xs text-rose-300">{errMsg}</p>}
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Story Title</label>
              <input
                type="text"
                required
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Era / Decade</label>
              <input
                type="text"
                value={storyEra}
                onChange={(e) => setStoryEra(e.target.value)}
                placeholder="e.g. 1970s Reunion"
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-sky-100/80 mb-1">Story Narrative</label>
              <textarea
                rows={5}
                required
                value={storyContent}
                onChange={(e) => setStoryContent(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-sm text-white"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-sky-100/80 cursor-pointer">
              <input
                type="checkbox"
                checked={storyPublic}
                onChange={(e) => setStoryPublic(e.target.checked)}
              />
              <span>Visible in public heritage chronicle</span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStoryModal(false)}
                className="px-4 py-2 rounded-xl border border-sky-300/25 text-xs text-sky-100/80 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-sky-300 text-sky-950 font-semibold text-xs cursor-pointer"
              >
                {busy ? 'Publishing...' : 'Publish Story'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
