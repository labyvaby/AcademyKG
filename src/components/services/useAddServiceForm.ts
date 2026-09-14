/**
 * useAddServiceForm.ts
 * Хук инкапсулирует ВСЮ логику формы добавления услуги:
 * - состояния (name, price, photoFile, photoPreview, busy)
 * - эффекты (сброс состояния при закрытии)
 * - обработчики (handleSubmit, onPickPhoto, fileToDataUrl)
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { useNotification } from "@refinedev/core";
import { createService } from "../../services/services";
import { useEffectiveBranch } from "../../hooks/useEffectiveBranch";

export type CreatedService = {
  id: string;
  name: string;
  price: number;
  service_name: string;
  price_som: number;
  employee_id: string | null;
  employee_name: string | null;
  photo_url: string | null;
  isGroup?: boolean;
};

type UseAddServiceFormArgs = {
  open: boolean;
  onClose: () => void;
  onCreated?: (rec: CreatedService) => void;
};

export function useAddServiceForm({ open, onClose, onCreated }: UseAddServiceFormArgs) {
  const { t } = useTranslation();
  const { open: notify } = useNotification();
  // Не-суперадмину branch-context не отдаёт selectedBranch (филиал определяется
  // правами на сервере), поэтому берём эффективный филиал сотрудника
  // (primaryBranch) — иначе branchId пуст и создать услугу нельзя.
  const effectiveBranch = useEffectiveBranch();
  const branchId = effectiveBranch?.id ?? null;
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [isGroup, setIsGroup] = React.useState(false);
  const [maxParticipants, setMaxParticipants] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  // Сброс состояния при закрытии
  React.useEffect(() => {
    if (!open) {
      setName("");
      setPrice("");
      setDescription("");
      setIsActive(true);
      setIsGroup(false);
      setMaxParticipants("");
      setDurationMinutes("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setBusy(false);
      setTouched(false);
    }
  }, [open]);

  const fileToDataUrl = React.useCallback(
    (f: File) =>
      new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = reject;
        r.readAsDataURL(f);
      }),
    []
  );

  const onPickPhoto = React.useCallback(
    async (f: File | null) => {
      setPhotoFile(f);
      if (f) {
        try {
          const url = await fileToDataUrl(f);
          setPhotoPreview(url);
        } catch {
          setPhotoPreview(null);
        }
      } else {
        setPhotoPreview(null);
      }
    },
    [fileToDataUrl]
  );

  // Сабмит формы
  const handleSubmit = React.useCallback(async () => {
    setTouched(true);
    if (!branchId) {
      notify?.({ type: "error", message: t("services.selectBranchToCreate") });
      return;
    }
    const priceNum = Number(price);
    if (!name.trim() || !price || !Number.isFinite(priceNum) || priceNum <= 0) {
      notify?.({ type: "error", message: t("services.fillNameAndCost") });
      return;
    }
    if (isGroup && (!maxParticipants || Number(maxParticipants) <= 0)) {
      notify?.({ type: "error", message: t("services.specifyMaxParticipantsCount") });
      return;
    }

    try {
      setBusy(true);

      const created = await createService({
        name: name.trim(),
        priceSom: priceNum,
        branchId,
        description: description.trim(),
        isActive,
        isGroup,
        maxParticipants: isGroup && maxParticipants ? Number(maxParticipants) : null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        imageUrl: photoFile,
      });

      const out: CreatedService = {
        id: created.id,
        name: created.name,
        price: created.price || 0,
        service_name: created.name,
        price_som: created.price || 0,
        employee_id: null,
        employee_name: null,
        photo_url: created.photoUrl || null,
        isGroup: created.isGroup ?? false,
      };

      onCreated?.(out);
      notify?.({ type: "success", message: t("services.serviceCreated") });
      onClose();
    } catch (e: any) {
      console.error("Create service failed:", e);
      notify?.({ type: "error", message: t("services.createError") });
    } finally {
      setBusy(false);
    }
  }, [name, price, photoFile, description, isActive, isGroup, maxParticipants, durationMinutes, branchId, onClose, onCreated, notify, t]);

  const submitDisabled =
    !name.trim() ||
    !price ||
    Number(price) <= 0 ||
    (isGroup && (!maxParticipants || Number(maxParticipants) <= 0));

  return {
    state: {
      name,
      price,
      description,
      isActive,
      isGroup,
      maxParticipants,
      durationMinutes,
      photoFile,
      photoPreview,
      busy,
      touched,
    },
    handlers: {
      setName,
      setPrice,
      setDescription,
      setIsActive,
      setIsGroup,
      setMaxParticipants,
      setDurationMinutes,
      onPickPhoto,
      handleSubmit,
    },
    submitDisabled,
  };
}
