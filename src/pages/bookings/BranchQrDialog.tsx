import React from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import QRCode from "react-qr-code";
import { useTranslation } from "react-i18next";

// QR со ссылкой на витрину филиала — распечатать на ресепшн или вставить в макет.
// PNG рисуем из того же SVG через canvas: печатники и мессенджеры SVG не любят.

const PNG_SIZE = 1024;
const PNG_MARGIN = 64;

async function svgToPng(svg: SVGSVGElement): Promise<string> {
  const markup = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("qr image"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = PNG_SIZE + PNG_MARGIN * 2;
    canvas.height = PNG_SIZE + PNG_MARGIN * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, PNG_MARGIN, PNG_MARGIN, PNG_SIZE, PNG_SIZE);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const BranchQrDialog: React.FC<{ open: boolean; onClose: () => void; link: string }> = ({ open, onClose, link }) => {
  const { t } = useTranslation();
  const boxRef = React.useRef<HTMLDivElement>(null);

  const download = async () => {
    const svg = boxRef.current?.querySelector("svg");
    if (!svg) return;
    const a = document.createElement("a");
    a.href = await svgToPng(svg);
    a.download = `qr-${link.split("/").pop() || "book"}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("bookings.settings.qrTitle")}</DialogTitle>
      <DialogContent>
        <Box ref={boxRef} sx={{ p: 2, bgcolor: "#fff", borderRadius: 2, display: "flex", justifyContent: "center" }}>
          <QRCode value={link} size={240} level="M" />
        </Box>
        <Typography variant="body2" textAlign="center" sx={{ mt: 1.5, wordBreak: "break-all" }}>
          {link}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" textAlign="center" sx={{ mt: 1 }}>
          {t("bookings.settings.qrHint")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("bookings.drawer.cancel")}</Button>
        <Button variant="contained" startIcon={<DownloadOutlined />} onClick={download}>
          {t("bookings.settings.qrDownload")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
