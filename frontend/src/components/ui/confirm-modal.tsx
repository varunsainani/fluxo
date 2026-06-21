"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  body,
  loading,
  danger = true,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  body?: React.ReactNode;
  loading?: boolean;
  danger?: boolean;
  confirmLabel?: string;
}) {
  const tc = useTranslations("common");
  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {tc("cancel")}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {danger && <Trash2 size={15} />}
            {confirmLabel ?? tc("delete")}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
