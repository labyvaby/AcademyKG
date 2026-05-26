/**
 * PatientPhotoUploader.tsx
 * UI-блок для выбора фото пациента (превью + input type="file").
 */
import React from "react";
import { Stack, Typography, CardContent, Avatar, Box, IconButton } from "@mui/material";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { AppCard } from "../ui";

export type PatientPhotoUploaderProps = {
  photoFile: File | null;
  photoPreview: string | null;
  inputId?: string;
  onPickPhoto: (file: File | null) => void;
  onRemovePhoto?: () => void;
};

const PatientPhotoUploader: React.FC<PatientPhotoUploaderProps> = ({
  photoPreview,
  inputId = "add-patient-file-input",
  onPickPhoto,
  onRemovePhoto,
}) => {
  return (
    <Stack spacing={0.5}>
      <AppCard variant="outlined" sx={{ borderStyle: "dashed" }} disableContentPadding>
        <CardContent
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 2,
            cursor: "pointer",
          }}
          onClick={() => {
            const el = document.getElementById(inputId) as HTMLInputElement | null;
            el?.click();
          }}
        >
          <Box sx={{ position: "relative", flexShrink: 0 }}>
            <Avatar variant="rounded" src={photoPreview || undefined} sx={{ width: 48, height: 48 }}>
              <PhotoCameraOutlined />
            </Avatar>
            {photoPreview && onRemovePhoto && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePhoto();
                }}
                sx={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  bgcolor: "error.main",
                  color: "white",
                  width: 20,
                  height: 20,
                  "&:hover": { bgcolor: "error.dark" },
                }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 13 }} />
              </IconButton>
            )}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {photoPreview ? "Сменить фото" : "Добавить фото"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Необязательно
            </Typography>
          </Box>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
              onPickPhoto(f);
            }}
          />
        </CardContent>
      </AppCard>
    </Stack>
  );
};

export default PatientPhotoUploader;
