"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { BackgroundColor, Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  Highlighter,
  Italic,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  Rows3,
  Save,
  Strikethrough,
  Table2,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2
} from "lucide-react";
import { ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { LinkPopover } from "@/components/editor/link-popover";
import { downloadTextFile } from "@/lib/download";
import type { SaveStatus } from "@/types/domain";

type RichTextEditorProps = {
  initialContentJson: Record<string, unknown>;
  initialVersion: number;
  placeholder: string;
  onSave: (input: {
    contentJson: Record<string, unknown>;
    contentHtml: string;
    plainText: string;
    wordCount: number;
    previousContentVersion: number;
    nextContentVersion: number;
  }) => Promise<void>;
  onImageUpload?: (file: File) => Promise<string>;
  showDerivedQuestionEntry?: boolean;
  onCreateDerivedQuestion?: (selectedText: string) => void;
};

const textColors = [
  { label: "黑色", value: "#111827" },
  { label: "深灰", value: "#374151" },
  { label: "灰色", value: "#6b7280" },
  { label: "白色", value: "#ffffff" },
  { label: "红色", value: "#dc2626" },
  { label: "橙色", value: "#ea580c" },
  { label: "琥珀", value: "#d97706" },
  { label: "金色", value: "#ca8a04" },
  { label: "青柠", value: "#65a30d" },
  { label: "绿色", value: "#16a34a" },
  { label: "青绿", value: "#0d9488" },
  { label: "青色", value: "#0891b2" },
  { label: "天蓝", value: "#0284c7" },
  { label: "蓝色", value: "#2563eb" },
  { label: "靛蓝", value: "#4f46e5" },
  { label: "紫色", value: "#7c3aed" },
  { label: "品红", value: "#c026d3" },
  { label: "粉色", value: "#db2777" },
  { label: "玫红", value: "#be123c" },
  { label: "棕色", value: "#92400e" }
];
const highlightColors = [
  { label: "黄色", value: "#fef08a" },
  { label: "浅琥珀", value: "#fde68a" },
  { label: "浅橙", value: "#fed7aa" },
  { label: "浅红", value: "#fecaca" },
  { label: "浅粉", value: "#fbcfe8" },
  { label: "浅玫", value: "#fce7f3" },
  { label: "浅紫", value: "#e9d5ff" },
  { label: "浅靛", value: "#ddd6fe" },
  { label: "浅蓝", value: "#bfdbfe" },
  { label: "浅天蓝", value: "#bae6fd" },
  { label: "浅青", value: "#a5f3fc" },
  { label: "浅青绿", value: "#99f6e4" },
  { label: "浅绿", value: "#bbf7d0" },
  { label: "浅青柠", value: "#d9f99d" },
  { label: "浅灰", value: "#e5e7eb" },
  { label: "浅石色", value: "#e7e5e4" },
  { label: "淡黄", value: "#fef3c7" },
  { label: "淡蓝灰", value: "#e0f2fe" }
];
const fontFamilies = [
  { label: "默认字体", value: "" },
  { label: "黑体/雅黑", value: "'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', 'Source Han Sans SC', sans-serif" },
  { label: "宋体", value: "SimSun, 'Noto Serif CJK SC', 'Source Han Serif SC', serif" },
  { label: "楷体", value: "KaiTi, 'STKaiti', 'AR PL UKai CN', serif" },
  { label: "等宽", value: "'Courier New', 'Noto Sans Mono CJK SC', 'Source Code Pro', monospace" }
];
const fontSizes = [
  { label: "默认字号", value: "" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "22", value: "22px" },
  { label: "28", value: "28px" }
];

function getInitialContent(contentJson: Record<string, unknown>) {
  if (contentJson && contentJson.type === "doc") {
    return contentJson;
  }

  return "";
}

function countText(text: string) {
  return text.replace(/\s+/g, "").length;
}

function getImageFiles(files: FileList | File[] | null | undefined) {
  return Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
}

function getImageFilesFromItems(items: DataTransferItemList | null | undefined) {
  return Array.from(items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

function getImageFilesFromDataTransfer(dataTransfer: DataTransfer | null | undefined) {
  const files = [...getImageFiles(dataTransfer?.files), ...getImageFilesFromItems(dataTransfer?.items)];
  const seen = new Set<string>();

  return files.filter((file) => {
    const key = `${file.name}:${file.type}:${file.size}:${file.lastModified}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

type ColorOption = {
  label: string;
  value: string;
};

type ColorPaletteButtonProps = {
  ariaLabel: string;
  clearLabel: string;
  colors: ColorOption[];
  currentColor: string;
  icon: ReactNode;
  isOpen: boolean;
  onClear: () => void;
  onSelect: (color: string) => void;
  onToggle: () => void;
};

function ColorPaletteButton({
  ariaLabel,
  clearLabel,
  colors,
  currentColor,
  icon,
  isOpen,
  onClear,
  onSelect,
  onToggle
}: ColorPaletteButtonProps) {
  return (
    <div className="color-picker">
      <button
        type="button"
        className={`tool-button color-trigger ${isOpen ? "active" : ""}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
        title={ariaLabel}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        {icon}
        <span className="color-trigger-swatch" style={{ backgroundColor: currentColor }} />
      </button>
      {isOpen ? (
        <div className="color-popover" role="menu" aria-label={ariaLabel}>
          <button
            type="button"
            className="color-clear-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClear}
            title={clearLabel}
            aria-label={clearLabel}
          >
            <Eraser size={14} />
          </button>
          <div className="color-grid">
            {colors.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`color-swatch ${color.value.toLowerCase() === currentColor.toLowerCase() ? "active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(color.value)}
                title={color.label}
                aria-label={color.label}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RichTextEditor({
  initialContentJson,
  initialVersion,
  placeholder,
  onSave,
  onImageUpload,
  showDerivedQuestionEntry = false,
  onCreateDerivedQuestion
}: RichTextEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [failedImageFiles, setFailedImageFiles] = useState<File[]>([]);
  const [imageUploadProgress, setImageUploadProgress] = useState<{ uploaded: number; total: number } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [openColorPalette, setOpenColorPalette] = useState<"text" | "highlight" | null>(null);
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const linkPickerRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const pendingImageUploads = useRef(0);
  const shouldSaveAfterImageUpload = useRef(false);
  const objectUrlsToRevoke = useRef(new Set<string>());
  const versionRef = useRef(initialVersion);
  const saveStatusRef = useRef<SaveStatus>("idle");
  const saveRef = useRef<(currentEditor?: Editor | null) => Promise<void>>(async () => undefined);
  const openLinkPopoverRef = useRef<() => void>(() => undefined);
  const isSettingInitialContent = useRef(false);
  const hasLoadedInitialContent = useRef(false);
  const initialContent = useMemo(() => getInitialContent(initialContentJson), [initialContentJson]);

  function updateSaveStatus(status: SaveStatus) {
    saveStatusRef.current = status;
    setSaveStatus(status);
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        link: false,
        underline: false
      }),
      TextStyle,
      Color,
      BackgroundColor,
      FontFamily,
      FontSize,
      Underline,
      Highlight.configure({
        multicolor: true
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          loading: "lazy"
        }
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank"
        }
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "editor-surface"
      },
      handlePaste: (_view, event) => {
        const clipboardData = event.clipboardData;
        const imageFiles = getImageFilesFromDataTransfer(clipboardData);

        if (imageFiles.length === 0) {
          return false;
        }

        // If clipboard also has HTML (e.g., "Copy image" from a web page),
        // let Tiptap handle it so the image appears via its external URL.
        // Only intercept pure-file pastes (screenshots, file copies from Explorer).
        const hasHtml = clipboardData?.types.includes("text/html");
        if (hasHtml) {
          return false;
        }

        event.preventDefault();
        void uploadImages(imageFiles);
        return true;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) {
          return false;
        }

        const dataTransfer = event.dataTransfer;

        // If the drop has HTML content alongside files, let the browser/Tiptap
        // handle it normally.
        if (dataTransfer && dataTransfer.types.includes("text/html")) {
          return false;
        }

        const imageFiles = getImageFilesFromDataTransfer(dataTransfer);

        if (imageFiles.length === 0) {
          return false;
        }

        event.preventDefault();
        void uploadImages(imageFiles);
        return true;
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (isSettingInitialContent.current) {
        return;
      }

      updateSaveStatus("dirty");
      setSaveError(null);

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(() => {
        void save(currentEditor);
      }, 1000);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editorRef.current = editor;

    if (hasLoadedInitialContent.current) {
      versionRef.current = Math.max(versionRef.current, initialVersion);
      return;
    }

    versionRef.current = initialVersion;
    hasLoadedInitialContent.current = true;
    isSettingInitialContent.current = true;
    editor.commands.setContent(initialContent);
    queueMicrotask(() => {
      isSettingInitialContent.current = false;
      updateSaveStatus("idle");
    });
  }, [editor, initialContent, initialVersion]);

  async function save(currentEditor?: Editor | null) {
    const activeEditor = currentEditor ?? editor ?? editorRef.current;

    if (!activeEditor) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    if (pendingImageUploads.current > 0) {
      shouldSaveAfterImageUpload.current = true;
      updateSaveStatus("dirty");
      return;
    }

    updateSaveStatus("saving");

    const plainText = activeEditor.getText();
    const previousVersion = versionRef.current;
    const nextVersion = previousVersion + 1;

    try {
      await onSave({
        contentJson: activeEditor.getJSON() as Record<string, unknown>,
        contentHtml: activeEditor.getHTML(),
        plainText,
        wordCount: countText(plainText),
        previousContentVersion: previousVersion,
        nextContentVersion: nextVersion
      });
      versionRef.current = nextVersion;
      updateSaveStatus("saved");
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败，请稍后重试。");
      updateSaveStatus("error");
    }
  }

  function exportDraft() {
    const activeEditor = editorRef.current ?? editor;

    if (!activeEditor) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    downloadTextFile(`note-draft-${timestamp}.html`, activeEditor.getHTML(), "text/html");
  }

  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    const objectUrls = objectUrlsToRevoke.current;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saveStatusRef.current === "dirty" || saveStatusRef.current === "saving") {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        void saveRef.current(editorRef.current);
        event.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function normalizeLinkUrl(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    if (trimmed.startsWith("/") || trimmed.startsWith("#") || /^mailto:|^tel:/i.test(trimmed)) {
      return trimmed;
    }

    const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("只支持 http、https、mailto、tel 或站内链接。");
    }

    return url.toString();
  }

  function openLinkPopover() {
    if (!editor) {
      return;
    }

    rememberSelection();
    setOpenColorPalette(null);
    setLinkDraft((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(null);
    setIsLinkPopoverOpen(true);
  }

  useEffect(() => {
    openLinkPopoverRef.current = openLinkPopover;
  });

  useEffect(() => {
    function handleEditorShortcut(event: KeyboardEvent) {
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (!isModifierPressed || event.altKey) {
        return;
      }

      const activeElement = document.activeElement;
      const isInsideEditor =
        editorRef.current?.isFocused ||
        Boolean(activeElement && editorShellRef.current?.contains(activeElement));

      if (!isInsideEditor) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "s") {
        event.preventDefault();
        void saveRef.current(editorRef.current);
        return;
      }

      if (key === "k") {
        event.preventDefault();
        openLinkPopoverRef.current();
      }
    }

    window.addEventListener("keydown", handleEditorShortcut);
    return () => window.removeEventListener("keydown", handleEditorShortcut);
  }, []);

  function closeLinkPopover() {
    setIsLinkPopoverOpen(false);
    setLinkError(null);
  }

  useEffect(() => {
    if (!isLinkPopoverOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && linkPickerRef.current?.contains(target)) {
        return;
      }

      closeLinkPopover();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLinkPopover();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isLinkPopoverOpen]);

  function applyLink() {
    const chain = getSelectionChain();

    if (!chain) {
      return;
    }

    let normalizedUrl: string;

    try {
      normalizedUrl = normalizeLinkUrl(linkDraft);
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : "链接格式不正确。");
      return;
    }

    if (!normalizedUrl) {
      chain.extendMarkRange("link").unsetLink().run();
      closeLinkPopover();
      return;
    }

    chain.extendMarkRange("link").setLink({ href: normalizedUrl }).run();
    closeLinkPopover();
  }

  function removeLink() {
    const chain = getSelectionChain();

    if (!chain) {
      return;
    }

    chain.extendMarkRange("link").unsetLink().run();
    setLinkDraft("");
    closeLinkPopover();
  }

  function setFontFamily(event: ChangeEvent<HTMLSelectElement>) {
    if (!editor) {
      return;
    }

    const value = event.target.value;

    if (!value) {
      editor.chain().focus().unsetFontFamily().run();
      return;
    }

    editor.chain().focus().setFontFamily(value).run();
  }

  function setFontSize(event: ChangeEvent<HTMLSelectElement>) {
    if (!editor) {
      return;
    }

    const value = event.target.value;

    if (!value) {
      editor.chain().focus().unsetFontSize().run();
      return;
    }

    editor.chain().focus().setFontSize(value).run();
  }

  function clearFormat() {
    if (!editor) {
      return;
    }

    editor.chain().focus().unsetAllMarks().unsetTextAlign().clearNodes().run();
  }

  function rememberSelection() {
    if (!editor) {
      return;
    }

    const { from, to } = editor.state.selection;
    savedSelectionRef.current = { from, to };
  }

  function getSelectionChain() {
    if (!editor) {
      return null;
    }

    const selection = savedSelectionRef.current;
    const chain = editor.chain().focus();

    if (selection && selection.from !== selection.to) {
      return chain.setTextSelection(selection);
    }

    return chain;
  }

  function setTextColor(color: string) {
    const chain = getSelectionChain();

    if (!chain) {
      return;
    }

    chain.setColor(color).run();
    setOpenColorPalette(null);
  }

  function clearTextColor() {
    const chain = getSelectionChain();

    if (!chain) {
      return;
    }

    chain.unsetColor().run();
    setOpenColorPalette(null);
  }

  function setHighlightColor(color: string) {
    const chain = getSelectionChain();

    if (!chain) {
      return;
    }

    chain.setHighlight({ color }).run();
    setOpenColorPalette(null);
  }

  function clearHighlightColor() {
    const chain = getSelectionChain();

    if (!chain) {
      return;
    }

    chain.unsetHighlight().run();
    setOpenColorPalette(null);
  }

  function toggleColorPalette(palette: "text" | "highlight") {
    rememberSelection();
    setIsLinkPopoverOpen(false);
    setOpenColorPalette((current) => (current === palette ? null : palette));
  }

  async function uploadImages(files: File[]) {
    const activeEditor = editorRef.current ?? editor;

    if (!activeEditor || files.length === 0) {
      return;
    }

    if (!onImageUpload) {
      setImageError("当前正文没有配置图片上传。");
      return;
    }

    setImageError(null);
    setFailedImageFiles([]);
    setImageUploadProgress({ uploaded: 0, total: files.length });
    setIsUploadingImage(true);
    pendingImageUploads.current += files.length;

    try {
      const previews = files.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        objectUrlsToRevoke.current.add(previewUrl);
        activeEditor.chain().focus().setImage({ src: previewUrl, alt: file.name, title: "上传中" }).run();
        return { file, previewUrl };
      });

      const results = await Promise.allSettled(
        previews.map(async ({ file, previewUrl }) => {
          const imageUrl = await onImageUpload(file);
          replaceImageSource(activeEditor, previewUrl, imageUrl, file.name);
          URL.revokeObjectURL(previewUrl);
          objectUrlsToRevoke.current.delete(previewUrl);
          setImageUploadProgress((current) =>
            current ? { ...current, uploaded: Math.min(current.total, current.uploaded + 1) } : current
          );
        })
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;

      if (failedCount > 0) {
        const failedFiles = previews
          .filter((_, index) => results[index]?.status === "rejected")
          .map(({ file }) => file);

        for (const { previewUrl } of previews) {
          const isStillPreview = hasImageSource(activeEditor, previewUrl);

          if (isStillPreview) {
            removeImageBySource(activeEditor, previewUrl);
            URL.revokeObjectURL(previewUrl);
            objectUrlsToRevoke.current.delete(previewUrl);
          }
        }

        const firstError = results.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
        setFailedImageFiles(failedFiles);
        setImageError(firstError instanceof Error ? firstError.message : "图片上传失败。");
      }
    } finally {
      pendingImageUploads.current = Math.max(0, pendingImageUploads.current - files.length);
      setIsUploadingImage(pendingImageUploads.current > 0);
      if (pendingImageUploads.current === 0) {
        setImageUploadProgress(null);
      }

      if (pendingImageUploads.current === 0 && (shouldSaveAfterImageUpload.current || saveStatusRef.current === "dirty")) {
        shouldSaveAfterImageUpload.current = false;
        void save(activeEditor);
      }

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  if (!editor) {
    return <div className="editor-loading">正在加载编辑器...</div>;
  }

  const textStyleAttributes = editor.getAttributes("textStyle");
  const highlightAttributes = editor.getAttributes("highlight");
  const currentTextColor = (textStyleAttributes.color as string | undefined) ?? textColors[0].value;
  const currentHighlight = (highlightAttributes.color as string | undefined) ?? highlightColors[0].value;
  const currentFontFamily = (textStyleAttributes.fontFamily as string | undefined) ?? "";
  const currentFontSize = (textStyleAttributes.fontSize as string | undefined) ?? "";

  return (
    <div className="editor-shell" ref={editorShellRef}>
      <div className="editor-toolbar" aria-label="正文工具栏">
        <button type="button" className="tool-button" onClick={() => editor.chain().focus().undo().run()} title="撤销">
          <Undo2 size={16} />
        </button>
        <button type="button" className="tool-button" onClick={() => editor.chain().focus().redo().run()} title="重做">
          <Redo2 size={16} />
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className={`tool-button ${editor.isActive("heading", { level: 1 }) ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="一级标题"
        >
          <Heading1 size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive("heading", { level: 2 }) ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="二级标题"
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive("heading", { level: 3 }) ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="三级标题"
        >
          <Heading3 size={16} />
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className={`tool-button ${editor.isActive("bold") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive("italic") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive("underline") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线"
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive("strike") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="删除线"
        >
          <Strikethrough size={16} />
        </button>
        <button type="button" className="tool-button" onClick={clearFormat} title="清除格式">
          <Eraser size={16} />
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className={`tool-button ${editor.isActive({ textAlign: "left" }) ? "active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="左对齐"
        >
          <AlignLeft size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive({ textAlign: "center" }) ? "active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="居中"
        >
          <AlignCenter size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive({ textAlign: "right" }) ? "active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="右对齐"
        >
          <AlignRight size={16} />
        </button>
        <span className="toolbar-divider" />
        <button
          type="button"
          className={`tool-button ${editor.isActive("bulletList") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="无序列表"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive("orderedList") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="有序列表"
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          className={`tool-button ${editor.isActive("blockquote") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="引用"
        >
          <Quote size={16} />
        </button>
        <button type="button" className="tool-button" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线">
          <Minus size={16} />
        </button>
        <div className="link-picker" ref={linkPickerRef}>
          <button
            type="button"
            className={`tool-button ${editor.isActive("link") || isLinkPopoverOpen ? "active" : ""}`}
            onClick={openLinkPopover}
            title="链接"
            aria-label="链接"
            aria-expanded={isLinkPopoverOpen}
          >
            <LinkIcon size={16} />
          </button>
          {isLinkPopoverOpen ? (
            <LinkPopover
              value={linkDraft}
              error={linkError}
              onValueChange={(value) => {
                setLinkDraft(value);
                setLinkError(null);
              }}
              onApply={applyLink}
              onRemove={removeLink}
              onClose={closeLinkPopover}
            />
          ) : null}
        </div>
        <label
          className={`tool-button ${!onImageUpload || isUploadingImage ? "disabled" : ""}`}
          title={isUploadingImage ? "图片上传中" : !onImageUpload ? "图片上传未配置" : "上传图片"}
          aria-label="上传图片"
        >
          <ImageIcon size={16} />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={!onImageUpload || isUploadingImage}
            onChange={(event) => {
              const files = getImageFiles(event.target.files);
              if (files.length > 0) {
                void uploadImages(files);
              }
            }}
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              padding: 0,
              margin: "-1px",
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0
            }}
          />
        </label>
        <span className="toolbar-divider" />
        <label className="select-tool" title="字体">
          <Type size={15} />
          <select aria-label="字体" value={currentFontFamily} onChange={setFontFamily}>
            {fontFamilies.map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </label>
        <select className="compact-select" aria-label="字号" value={currentFontSize} onChange={setFontSize}>
          {fontSizes.map((size) => (
            <option key={size.label} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
        <ColorPaletteButton
          ariaLabel="文字颜色"
          clearLabel="清除文字颜色"
          colors={textColors}
          currentColor={currentTextColor}
          icon={<Palette size={15} />}
          isOpen={openColorPalette === "text"}
          onClear={clearTextColor}
          onSelect={setTextColor}
          onToggle={() => toggleColorPalette("text")}
        />
        <ColorPaletteButton
          ariaLabel="背景高亮"
          clearLabel="清除背景高亮"
          colors={highlightColors}
          currentColor={currentHighlight}
          icon={<Highlighter size={15} />}
          isOpen={openColorPalette === "highlight"}
          onClear={clearHighlightColor}
          onSelect={setHighlightColor}
          onToggle={() => toggleColorPalette("highlight")}
        />
        <span className="toolbar-divider" />
        <button type="button" className="tool-button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="插入表格">
          <Table2 size={16} />
        </button>
        <button type="button" className="tool-button" onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.isActive("table")} title="增加行">
          <Rows3 size={16} />
        </button>
        <button type="button" className="tool-button" onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.isActive("table")} title="增加列">
          <Columns3 size={16} />
        </button>
        <button type="button" className="tool-button danger-tool" onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.isActive("table")} title="删除行">
          <Rows3 size={15} />
        </button>
        <button type="button" className="tool-button danger-tool" onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.isActive("table")} title="删除列">
          <Columns3 size={15} />
        </button>
        <button type="button" className="tool-button danger-tool" onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.isActive("table")} title="删除表格">
          <Trash2 size={16} />
        </button>
        <span className="toolbar-spacer" />
        <button type="button" className="secondary-button" onClick={() => void save()} disabled={saveStatus === "saving" || isUploadingImage}>
          <Save size={15} />
          {isUploadingImage ? "上传中" : saveStatus === "saving" ? "保存中" : "保存"}
        </button>
        <span className={`save-state ${saveStatus}`}>
          {isUploadingImage
            ? "图片上传中"
            : saveStatus === "dirty"
            ? "未保存"
            : saveStatus === "saving"
              ? "保存中"
              : saveStatus === "saved"
                ? "已保存"
                : saveStatus === "error"
                  ? "保存失败"
                  : "已就绪"}
        </span>
      </div>

      {saveError ? (
        <div className="editor-inline-error editor-recovery-panel">
          <span>{saveError}</span>
          <button className="secondary-button" type="button" onClick={() => void save()} disabled={saveStatus === "saving"}>
            <Save size={14} />
            重试保存
          </button>
          <button className="secondary-button" type="button" onClick={exportDraft}>
            导出草稿
          </button>
        </div>
      ) : null}
      {imageUploadProgress ? (
        <p className="editor-inline-info">
          正在上传图片：{imageUploadProgress.uploaded}/{imageUploadProgress.total}
        </p>
      ) : null}
      {imageError ? (
        <div className="editor-inline-error editor-recovery-panel">
          <span>{imageError}</span>
          {failedImageFiles.length > 0 ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => void uploadImages(failedImageFiles)}
              disabled={isUploadingImage}
            >
              重试图片上传
            </button>
          ) : null}
        </div>
      ) : null}
      {editor ? (
        <BubbleMenu editor={editor} className="bubble-menu">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "active" : ""}
            title="加粗"
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "active" : ""}
            title="斜体"
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive("underline") ? "active" : ""}
            title="下划线"
          >
            <UnderlineIcon size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive("strike") ? "active" : ""}
            title="删除线"
          >
            <Strikethrough size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive("highlight") ? "active" : ""}
            title="高亮"
          >
            <Highlighter size={15} />
          </button>
          <button type="button" onClick={openLinkPopover} className={editor.isActive("link") ? "active" : ""} title="链接">
            <LinkIcon size={15} />
          </button>
          {showDerivedQuestionEntry && onCreateDerivedQuestion ? (
            <button
              type="button"
              onClick={() => {
                const selectedText = editor.state.doc.textBetween(
                  editor.state.selection.from,
                  editor.state.selection.to,
                  " "
                );
                onCreateDerivedQuestion(selectedText);
              }}
              title="从选中文本创建衍生问题"
            >
              <HelpCircle size={15} />
            </button>
          ) : null}
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function findImagePositionBySource(editor: Editor, src: string) {
  let imagePosition: number | null = null;

  editor.state.doc.descendants((node, position) => {
    if (node.type.name === "image" && node.attrs.src === src) {
      imagePosition = position;
      return false;
    }

    return true;
  });

  return imagePosition;
}

function hasImageSource(editor: Editor, src: string) {
  return findImagePositionBySource(editor, src) !== null;
}

function replaceImageSource(editor: Editor, previewUrl: string, imageUrl: string, fileName: string) {
  const imagePosition = findImagePositionBySource(editor, previewUrl);

  if (imagePosition === null) {
    return;
  }

  const imageNode = editor.state.doc.nodeAt(imagePosition);

  if (!imageNode) {
    return;
  }

  const transaction = editor.state.tr.setNodeMarkup(imagePosition, undefined, {
    ...imageNode.attrs,
    src: imageUrl,
    alt: imageNode.attrs.alt || fileName,
    title: null
  });

  editor.view.dispatch(transaction);
}

function removeImageBySource(editor: Editor, src: string) {
  const imagePosition = findImagePositionBySource(editor, src);

  if (imagePosition === null) {
    return;
  }

  const imageNode = editor.state.doc.nodeAt(imagePosition);

  if (!imageNode) {
    return;
  }

  editor.view.dispatch(editor.state.tr.delete(imagePosition, imagePosition + imageNode.nodeSize));
}
