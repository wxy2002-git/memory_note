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
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
    nextContentVersion: number;
  }) => Promise<void>;
  onImageUpload?: (file: File) => Promise<string>;
  showDerivedQuestionEntry?: boolean;
  onCreateDerivedQuestion?: (selectedText: string) => void;
};

const textColors = ["#1f2937", "#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c"];
const highlightColors = ["#fef08a", "#bbf7d0", "#bfdbfe", "#ddd6fe", "#fed7aa", "#fecdd3"];
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
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageUploads = useRef(0);
  const shouldSaveAfterImageUpload = useRef(false);
  const objectUrlsToRevoke = useRef(new Set<string>());
  const versionRef = useRef(initialVersion);
  const saveStatusRef = useRef<SaveStatus>("idle");
  const isSettingInitialContent = useRef(false);
  const hasLoadedInitialContent = useRef(false);
  const initialContent = useMemo(() => getInitialContent(initialContentJson), [initialContentJson]);

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

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saveStatusRef.current === "dirty" || saveStatusRef.current === "saving") {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        void save(editorRef.current);
        event.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      for (const url of objectUrlsToRevoke.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function updateSaveStatus(status: SaveStatus) {
    saveStatusRef.current = status;
    setSaveStatus(status);
  }

  async function save(currentEditor = editor) {
    const activeEditor = currentEditor ?? editorRef.current;

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
    const nextVersion = versionRef.current + 1;

    try {
      await onSave({
        contentJson: activeEditor.getJSON() as Record<string, unknown>,
        contentHtml: activeEditor.getHTML(),
        plainText,
        wordCount: countText(plainText),
        nextContentVersion: nextVersion
      });
      versionRef.current = nextVersion;
      updateSaveStatus("saved");
    } catch {
      updateSaveStatus("error");
    }
  }

  function setLink() {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("输入链接地址", previousUrl ?? "");

    if (url === null) {
      return;
    }

    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
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
        })
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;

      if (failedCount > 0) {
        for (const { previewUrl } of previews) {
          const isStillPreview = hasImageSource(activeEditor, previewUrl);

          if (isStillPreview) {
            removeImageBySource(activeEditor, previewUrl);
            URL.revokeObjectURL(previewUrl);
            objectUrlsToRevoke.current.delete(previewUrl);
          }
        }

        const firstError = results.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
        setImageError(firstError instanceof Error ? firstError.message : "图片上传失败。");
      }
    } finally {
      pendingImageUploads.current = Math.max(0, pendingImageUploads.current - files.length);
      setIsUploadingImage(pendingImageUploads.current > 0);

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
  const currentTextColor = (textStyleAttributes.color as string | undefined) ?? textColors[0];
  const currentHighlight = (textStyleAttributes.backgroundColor as string | undefined) ?? highlightColors[0];
  const currentFontFamily = (textStyleAttributes.fontFamily as string | undefined) ?? "";
  const currentFontSize = (textStyleAttributes.fontSize as string | undefined) ?? "";

  return (
    <div className="editor-shell">
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
        <button
          type="button"
          className={`tool-button ${editor.isActive("link") ? "active" : ""}`}
          onClick={setLink}
          title="链接"
        >
          <LinkIcon size={16} />
        </button>
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
        <label className="color-tool" title="文字颜色">
          <Palette size={15} />
          <input
            type="color"
            aria-label="文字颜色"
            value={currentTextColor}
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
        </label>
        <label className="color-tool" title="背景高亮">
          <Highlighter size={15} />
          <input
            type="color"
            aria-label="背景高亮"
            value={currentHighlight}
            onChange={(event) => editor.chain().focus().setBackgroundColor(event.target.value).run()}
          />
        </label>
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

      {imageError ? <p className="editor-inline-error">{imageError}</p> : null}
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
          <button type="button" onClick={setLink} className={editor.isActive("link") ? "active" : ""} title="链接">
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
