'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  ArrowLeft, Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Link2, ImageIcon, Quote, Code, Undo, Redo,
  CheckCircle, Loader2, Globe, EyeOff, X, Tag,
} from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { api }      from '@/lib/apiClient';
import { cn }       from '@/lib/utils';

interface BlogEditorProps {
  postId: string | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function BlogEditor({ postId }: BlogEditorProps) {
  const router = useRouter();

  const [title,      setTitle]      = useState('');
  const [excerpt,    setExcerpt]    = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [tags,       setTags]       = useState<string[]>([]);
  const [tagInput,   setTagInput]   = useState('');
  const [status,     setStatus]     = useState<'draft' | 'published'>('draft');
  const [saveState,  setSaveState]  = useState<SaveState>('idle');
  const [publishing, setPublishing] = useState(false);
  const [postLoaded, setPostLoaded] = useState(false);

  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedPostId   = useRef<string | null>(postId);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl,        setLinkUrl]        = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-brand-600 underline' } }),
      Image.configure({ HTMLAttributes: { class: 'rounded-xl max-w-full my-4' } }),
      Placeholder.configure({ placeholder: 'Start writing your post…' }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none min-h-[400px] px-8 py-6',
      },
    },
    onUpdate: () => triggerAutoSave(),
  });

  // Load existing post
  useEffect(() => {
    if (!postId) { setPostLoaded(true); return; }
    (api.blog as any).get(postId).then((post: any) => {
      setTitle(post.title ?? '');
      setExcerpt(post.excerpt ?? '');
      setCoverImage(post.cover_image_url ?? '');
      setTags(post.tags ?? []);
      setStatus(post.status ?? 'draft');
      editor?.commands.setContent(post.content_html ?? '');
      savedPostId.current = post.id;
      setPostLoaded(true);
    }).catch(() => setPostLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const readTime = useCallback(() => {
    const text = editor?.getText() ?? '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [editor]);

  const buildBody = useCallback(() => ({
    title,
    excerpt,
    cover_image_url: coverImage,
    tags,
    content_html: editor?.getHTML() ?? '',
    read_time_minutes: readTime(),
  }), [title, excerpt, coverImage, tags, editor, readTime]);

  async function saveDraft() {
    setSaveState('saving');
    try {
      const body = buildBody();
      if (savedPostId.current) {
        await (api.blog as any).update(savedPostId.current, body);
      } else {
        const res: any = await (api.blog as any).create(body);
        savedPostId.current = res.id;
        // Update URL without full navigation
        window.history.replaceState(null, '', `/dashboard/blog/${res.id}/edit`);
      }
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  function triggerAutoSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveDraft(), 2000);
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await saveDraft();
      if (status === 'published') {
        await (api.blog as any).unpublish(savedPostId.current!);
        setStatus('draft');
      } else {
        await (api.blog as any).publish(savedPostId.current!);
        setStatus('published');
      }
    } finally { setPublishing(false); }
  }

  async function handleImageUpload(file: File) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res: any = await (api.blog as any).uploadImage(formData);
      editor?.chain().focus().setImage({ src: res.url }).run();
    } catch { /* silently fail */ }
  }

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  }

  function setLink() {
    if (!linkUrl) { editor?.chain().focus().unsetLink().run(); }
    else { editor?.chain().focus().setLink({ href: linkUrl }).run(); }
    setLinkDialogOpen(false);
    setLinkUrl('');
  }

  if (!postLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const ToolBtn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded hover:bg-neutral-200 transition-colors',
        active ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-500',
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/blog')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <div className="flex items-center gap-3">
          {/* Save state indicator */}
          {saveState === 'saving' && (
            <span className="text-xs text-neutral-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
          )}
          {saveState === 'saved' && (
            <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Saved</span>
          )}
          {saveState === 'error' && (
            <span className="text-xs text-red-500">Save failed</span>
          )}

          <Button variant="outline" size="sm" onClick={saveDraft} disabled={saveState === 'saving'}>
            Save Draft
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing || !title.trim()}>
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : status === 'published' ? <><EyeOff className="w-4 h-4 mr-1" />Unpublish</> : <><Globe className="w-4 h-4 mr-1" />Publish</>}
          </Button>
        </div>
      </div>

      {/* Meta fields */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-4 space-y-4">
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); triggerAutoSave(); }}
          placeholder="Post title…"
          className="w-full text-3xl font-serif font-bold text-neutral-900 placeholder:text-neutral-300 border-none outline-none bg-transparent resize-none"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-neutral-500 uppercase tracking-wide">Excerpt</Label>
            <textarea
              value={excerpt}
              onChange={e => { setExcerpt(e.target.value); triggerAutoSave(); }}
              rows={2}
              placeholder="Short description for previews…"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
          <div>
            <Label className="text-xs text-neutral-500 uppercase tracking-wide">Cover Image URL</Label>
            <Input
              value={coverImage}
              onChange={e => { setCoverImage(e.target.value); triggerAutoSave(); }}
              placeholder="https://…"
              className="mt-1"
            />
            {coverImage && (
              <img src={coverImage} alt="" className="mt-2 rounded-lg h-20 w-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <Label className="text-xs text-neutral-500 uppercase tracking-wide">Tags</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {tags.map(t => (
              <span key={t} className="flex items-center gap-1 text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full">
                <Tag className="w-3 h-3" />{t}
                <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="ml-0.5 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
              }}
              placeholder="Add tag…"
              className="text-xs border-none outline-none bg-transparent placeholder:text-neutral-400 min-w-[80px]"
            />
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-4 py-2 flex items-center gap-0.5 flex-wrap">
          <ToolBtn title="Bold" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Italic" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Strikethrough" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
            <Strikethrough className="w-4 h-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          <ToolBtn title="Heading 1" active={editor?.isActive('heading', { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Heading 2" active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Heading 3" active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="w-4 h-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          <ToolBtn title="Bullet List" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Ordered List" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="w-4 h-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          <ToolBtn title="Blockquote" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Code Block" active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
            <Code className="w-4 h-4" />
          </ToolBtn>
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          {/* Link */}
          <div className="relative">
            <ToolBtn title="Link" active={editor?.isActive('link')} onClick={() => { setLinkUrl(editor?.getAttributes('link').href ?? ''); setLinkDialogOpen(v => !v); }}>
              <Link2 className="w-4 h-4" />
            </ToolBtn>
            {linkDialogOpen && (
              <div className="absolute top-8 left-0 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 flex gap-2 z-20 w-72">
                <Input
                  autoFocus
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  onKeyDown={e => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setLinkDialogOpen(false); }}
                  className="flex-1 text-xs"
                />
                <Button size="sm" onClick={setLink}>Set</Button>
              </div>
            )}
          </div>
          {/* Image upload */}
          <ToolBtn title="Insert Image" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="w-4 h-4" />
          </ToolBtn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
          />
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          <ToolBtn title="Undo" onClick={() => editor?.chain().focus().undo().run()}>
            <Undo className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Redo" onClick={() => editor?.chain().focus().redo().run()}>
            <Redo className="w-4 h-4" />
          </ToolBtn>
          <div className="ml-auto text-xs text-neutral-400">{readTime()} min read</div>
        </div>

        {/* TipTap editor area */}
        <EditorContent editor={editor} />
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between mt-4 pb-8">
        <p className="text-xs text-neutral-400">
          {status === 'published' ? 'Currently published · changes auto-save' : 'Draft · auto-saves every 2s'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={saveState === 'saving'}>
            Save Draft
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={publishing || !title.trim()}>
            {status === 'published' ? 'Unpublish' : 'Publish Post'}
          </Button>
        </div>
      </div>
    </div>
  );
}
