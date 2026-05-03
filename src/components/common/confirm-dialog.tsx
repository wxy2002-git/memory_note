"use client";

import { AlertTriangle, X } from "lucide-react";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "确认删除",
  cancelLabel = "取消",
  isPending,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <div className="confirm-dialog" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="confirm-close" type="button" onClick={onCancel} aria-label="关闭确认框" disabled={isPending}>
          <X size={16} />
        </button>
        <div className="confirm-icon" aria-hidden="true">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h2 id="confirm-title">{title}</h2>
          <p id="confirm-message">{message}</p>
        </div>
        <div className="confirm-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={isPending}>
            {isPending ? "删除中" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
