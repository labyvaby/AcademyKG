/**
 * useAddServiceForm.ts
 * Хук инкапсулирует ВСЮ логику формы добавления услуги:
 * - состояния (name, price, photoFile, photoPreview, busy)
 * - эффекты (сброс состояния при закрытии)
 * - обработчики (handleSubmit, onPickPhoto, fileToDataUrl)
 */
import React from "react";
import { useNotification } from "@refinedev/core";
import { createService } from "../../services/services";

export type CreatedService = {
  id: string;
  name: string;
  price: number;
  service_name: string;
  price_som: number;
  employee_id: string | null;
  employee_name: string | null;
  photo_url: string | null;
};

type UseAddServiceFormArgs = {
  open: boolean;
  onClose: () => void;
  onCreated?: (rec: CreatedService) => void;
};

export function useAddServiceForm({ open, onClose, onCreated }: UseAddServiceFormArgs) {
  const { open: notify } = useNotification();
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
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
    const priceNum = Number(price);
    if (!name.trim() || !price || !Number.isFinite(priceNum) || priceNum <= 0) {
      notify?.({ type: "error", message: "Заполните название и положительную стоимость услуги" });
      return;
    }

    try {
      setBusy(true);

      const created = await createService({
        name: name.trim(),
        priceSom: priceNum,
        description: description.trim(),
        isActive,
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
      };

      onCreated?.(out);
      notify?.({ type: "success", message: "Услуга создана" });
      onClose();
    } catch (e) {
      console.error("Create service failed:", e);
      notify?.({ type: "error", message: "Не удалось создать услугу" });
    } finally {
      setBusy(false);
    }
  }, [name, price, photoFile, description, isActive, onClose, onCreated, notify]);

  const submitDisabled = !name.trim() || !price || Number(price) <= 0;

  return {
    state: {
      name,
      price,
      description,
      isActive,
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
      onPickPhoto,
      handleSubmit,
    },
    submitDisabled,
  };
}
