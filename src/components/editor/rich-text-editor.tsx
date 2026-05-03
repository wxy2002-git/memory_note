"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Heading1, Heading2, Italic, Link as LinkIcon, List, ListOrdered, Quote, Redo2, Save, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
};

function getInitialContent(contentJson: Record<string, unknown>) {
  if (contentJson && contentJson.type === "doc") {
    return contentJson;
  }

  return "";
}

function countText(text: string) {
  return text.replace(/\s+/g, "").length;
}

export function RichTextEditor({
  initialContentJson,
  initialVersion,
  placeholder,
  onSave
}: RichTextEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(initialVersion);
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
      Underline,
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
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (isSettingInitialContent.current) {
        return;
      }

      setSaveStatus("dirty");

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
      setSaveStatus("idle");
    });
  }, [editor, initialContent, initialVersion]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  async function save(currentEditor = editor) {
    if (!currentEditor) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    setSaveStatus("saving");

    const plainText = currentEditor.getText();
    const nextVersion = versionRef.current + 1;

    try {
      await onSave({
        contentJson: currentEditor.getJSON() as Record<string, unknown>,
        contentHtml: currentEditor.getHTML(),
        plainText,
        wordCount: countText(plainText),
        nextContentVersion: nextVersion
      });
      versionRef.current = nextVersion;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
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

  if (!editor) {
    return <div className="editor-loading">正在加载编辑器...</div>;
  }

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
        <button
          type="button"
          className={`tool-button ${editor.isActive("link") ? "active" : ""}`}
          onClick={setLink}
          title="链接"
        >
          <LinkIcon size={16} />
        </button>
        <span className="toolbar-spacer" />
        <button type="button" className="secondary-button" onClick={() => void save()} disabled={saveStatus === "saving"}>
          <Save size={15} />
          {saveStatus === "saving" ? "保存中" : "保存"}
        </button>
        <span className={`save-state ${saveStatus}`}>{saveStatus === "dirty" ? "未保存" : saveStatus === "saving" ? "保存中" : saveStatus === "saved" ? "已保存" : saveStatus === "error" ? "保存失败" : "已就绪"}</span>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
