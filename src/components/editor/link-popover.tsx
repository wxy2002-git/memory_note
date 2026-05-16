"use client";

import { Eraser, Link as LinkIcon, X } from "lucide-react";

type LinkPopoverProps = {
  value: string;
  error: string | null;
  onValueChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  onClose: () => void;
};

export function LinkPopover({ value, error, onValueChange, onApply, onRemove, onClose }: LinkPopoverProps) {
  return (
    <form
      className="link-popover"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <input
        aria-label="链接地址"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="https://example.com"
        autoFocus
      />
      <button className="tool-button" type="submit" title="应用链接" aria-label="应用链接">
        <LinkIcon size={15} />
      </button>
      <button className="tool-button danger-tool" type="button" onClick={onRemove} title="移除链接" aria-label="移除链接">
        <Eraser size={15} />
      </button>
      <button className="tool-button" type="button" onClick={onClose} title="关闭" aria-label="关闭链接设置">
        <X size={15} />
      </button>
      {error ? <span className="link-popover-error">{error}</span> : null}
    </form>
  );
}
