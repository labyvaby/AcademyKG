import React, { useCallback, useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

/**
 * Определяет, находится ли фокус внутри текстового поля (клавиатура открыта на мобильном).
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

type UseModalBackdropGuardOptions = {
  /** Есть ли незасохранённые изменения в форме */
  isDirty: boolean;
  /** Вызывается когда закрытие подтверждено (пользователь нажал X/Отмена и подтвердил) */
  onClose: () => void;
  /** Текст заголовка диалога подтверждения */
  confirmTitle?: string;
  /** Текст вопроса диалога подтверждения */
  confirmMessage?: string;
};

type UseModalBackdropGuardResult = {
  /**
   * Передавать в onClose MUI Dialog/Drawer.
   * Обрабатывает backdropClick: если открыта клавиатура — только blur,
   * если форма dirty — показывает диалог, иначе закрывает.
   */
  handleClose: (event: object, reason: string) => void;
  /**
   * Передавать в onClick кнопок X / Отмена.
   * Если форма dirty — показывает диалог подтверждения,
   * иначе закрывает сразу.
   */
  handleCloseButton: () => void;
  /** Рендерить внутри компонента, чтобы диалог подтверждения был виден */
  ConfirmLeaveDialog: React.FC;
};

export function useModalBackdropGuard({
  isDirty,
  onClose,
  confirmTitle = "Закрыть без сохранения?",
  confirmMessage = "Введённые данные будут потеряны. Закрыть форму?",
}: UseModalBackdropGuardOptions): UseModalBackdropGuardResult {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClose = useCallback(
    (_event: object, reason: string) => {
      if (reason === "backdropClick") {
        if (isInputFocused()) {
          // Клавиатура открыта — только blur, не закрываем
          (document.activeElement as HTMLElement | null)?.blur();
          return;
        }
        if (isDirty) {
          setConfirmOpen(true);
          return;
        }
      }
      // escapeKeyDown или не backdropClick — закрываем сразу если нет dirty
      if (reason === "escapeKeyDown" && isDirty) {
        setConfirmOpen(true);
        return;
      }
      onClose();
    },
    [isDirty, onClose]
  );

  const handleCloseButton = useCallback(() => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    onClose();
  }, [onClose]);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const ConfirmLeaveDialog: React.FC = useCallback(
    () => (
      <ConfirmDialog
        open={confirmOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmText="Закрыть"
        cancelText="Остаться"
        variant="warning"
      />
    ),
    [confirmOpen, handleCancel, handleConfirm, confirmTitle, confirmMessage]
  ) as React.FC;

  return { handleClose, handleCloseButton, ConfirmLeaveDialog };
}
