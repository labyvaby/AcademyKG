import React from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    Drawer,
    IconButton,
    Stack,
    TextField,
    Typography,
    CardContent,
    Avatar,
    Paper,
    Tabs,
    Tab,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNotification } from "@refinedev/core";
import { updateProduct, Product, UpdateProductData } from "../../services/products";
import { AppCard } from "../ui";
import { useBranchCurrency } from "../../hooks/useBranchCurrency";

// Custom styles for the toggle tabs
const toggleTabStyles = (theme: any, color: string) => ({
    minHeight: 40,
    borderRadius: 1,
    textTransform: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "text.secondary",
    "&.Mui-selected": {
        color: theme.palette.getContrastText(color),
        bgcolor: color,
    },
    transition: "all 0.2s",
});

type EditProductDrawerProps = {
    open: boolean;
    product: Product | null;
    onClose: () => void;
    onUpdated?: () => void;
};

export const EditProductDrawer: React.FC<EditProductDrawerProps> = ({
    open,
    product,
    onClose,
    onUpdated,
}) => {
    const { t } = useTranslation();
    const { suffix } = useBranchCurrency();
    const { open: notify } = useNotification();
    const [values, setValues] = React.useState<UpdateProductData>({});
    const [photoFile, setPhotoFile] = React.useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [touched, setTouched] = React.useState(false);

    React.useEffect(() => {
        if (open && product) {
            setTouched(false);
            setValues({
                name: product.name,
                category: product.category || "",
                barcode: product.barcode || "",
                unit: product.unit || "",
                description: product.description || "",
                comment: product.comment || "",
                image_url: product.image_url || undefined,
                is_for_sale: product.is_for_sale ?? true,
                is_infusion: product.is_infusion ?? false,
                price: product.price || 0,
                stock: product.stock || 0,
            });
            setPreviewUrl(product.image_url || null);
        } else {
            setValues({});
            setPhotoFile(null);
            setPreviewUrl(null);
        }
    }, [open, product]);

    const handleFileChange = (file: File | null) => {
        setPhotoFile(file);
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setPreviewUrl(product?.image_url || null);
        }
    };

    const handleSubmit = async () => {
        setTouched(true);
        if (!product) return;
        if (!values.name?.trim()) {
            notify?.({ type: "error", message: t("products.nameRequiredError") });
            return;
        }

        setBusy(true);
        try {
            await updateProduct(product.sellable_item_id, {
                ...values,
                image_url: photoFile || values.image_url,
                name: values.name.trim(),
                barcode: values.barcode?.trim() || undefined,
                unit: values.unit?.trim() || undefined,
                category: values.category?.trim() || undefined,
                description: values.description?.trim() || undefined,
                comment: values.comment?.trim() || undefined,
                price: Number(values.price) || 0,
                stock: Number(values.stock) || 0,
            });

            if (onUpdated) onUpdated();
            notify?.({ type: "success", message: t("products.productUpdated") });
            onClose();
        } catch (e: unknown) {
            console.error("Update product failed:", e);
            notify?.({ type: "error", message: t("products.updateError") });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={busy ? undefined : onClose}
            PaperProps={{ sx: { width: { xs: 320, sm: 480, md: 520 }, maxWidth: "100vw", display: "flex", flexDirection: "column" } }}
        >
            <Box sx={{ width: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 2,
                        py: 1,
                    }}
                >
                    <Typography variant="h6">{t("products.editProduct")}</Typography>
                    <IconButton onClick={busy ? undefined : onClose} aria-label={t("common.close")}>
                        <CloseOutlined />
                    </IconButton>
                </Box>
                <Divider />
                <Box
                    sx={{
                        p: 2,
                        flex: 1,
                        overflowY: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        '&::-webkit-scrollbar': {
                            display: 'none',
                        },
                    }}
                >
                    <Stack spacing={3}>
                        {/* Photo Uploader */}
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
                                        const el = document.getElementById("edit-product-photo-input") as HTMLInputElement | null;
                                        el?.click();
                                    }}
                                >
                                    <Avatar
                                        variant="rounded"
                                        src={previewUrl || undefined}
                                        sx={{ width: 48, height: 48 }}
                                    >
                                        <PhotoCameraOutlined />
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2">
                                            {photoFile ? photoFile.name : t("products.changePhoto")}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t("products.optional")}
                                        </Typography>
                                    </Box>
                                    <input
                                        id="edit-product-photo-input"
                                        type="file"
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] || null;
                                            handleFileChange(f);
                                        }}
                                    />
                                </CardContent>
                            </AppCard>
                        </Stack>

                        {/* Name Input */}
                        <Stack spacing={0.5}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {t("products.productNameRequired")}
                            </Typography>
                            <TextField
                                placeholder={t("products.enterProductName")}
                                value={values.name || ""}
                                onChange={(e) => setValues((s) => ({ ...s, name: e.target.value }))}
                                fullWidth
                                error={touched && !values.name?.trim()}
                                helperText={touched && !values.name?.trim() ? t("common.requiredField") : ""}
                            />
                        </Stack>

                        {/* Barcode */}
                        <Stack spacing={0.5}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {t("products.barcode")}
                            </Typography>
                            <TextField
                                placeholder={t("products.enterBarcode")}
                                value={values.barcode || ""}
                                onChange={(e) => setValues((s) => ({ ...s, barcode: e.target.value }))}
                                fullWidth
                            />
                        </Stack>

                        <Stack direction="row" spacing={2}>
                            {/* Category */}
                            <Stack spacing={0.5} sx={{ flex: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {t("expenses.category")}
                                </Typography>
                                <TextField
                                    placeholder={t("expenses.category")}
                                    value={values.category || ""}
                                    onChange={(e) => setValues((s) => ({ ...s, category: e.target.value }))}
                                    fullWidth
                                />
                            </Stack>
                            {/* Unit */}
                            <Stack spacing={0.5} sx={{ flex: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {t("products.unit")}
                                </Typography>
                                <TextField
                                    placeholder={t("products.unitPlaceholder")}
                                    value={values.unit || ""}
                                    onChange={(e) => setValues((s) => ({ ...s, unit: e.target.value }))}
                                    fullWidth
                                />
                            </Stack>
                        </Stack>

                        {/* Sale Status Toggle */}
                        <Paper
                            elevation={0}
                            variant="outlined"
                            sx={{
                                p: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between"
                            }}
                        >
                            <Typography variant="body2">{t("products.saleStatus")}</Typography>
                            <Tabs
                                value={values.is_for_sale ? 0 : 1}
                                onChange={(_, v) =>
                                    setValues((s) => ({ ...s, is_for_sale: v === 0 }))
                                }
                                sx={{ minHeight: 32 }}
                                TabIndicatorProps={{ style: { display: "none" } }}
                            >
                                <Tab
                                    label={t("products.saleStatusActive")}
                                    sx={(theme) => ({ ...toggleTabStyles(theme, theme.palette.success.main), minHeight: 32, py: 0, px: 2 })}
                                />
                                <Tab
                                    label={t("products.saleStatusUnavailable")}
                                    sx={(theme) => ({ ...toggleTabStyles(theme, theme.palette.action.disabledBackground), minHeight: 32, py: 0, px: 2, '&.Mui-selected': { bgcolor: 'action.selected', color: 'text.primary' } })}
                                />
                            </Tabs>
                        </Paper>

                        {/* Price & Stock - Standard Inputs */}
                        <Stack direction="row" spacing={2}>
                            <Stack spacing={0.5} sx={{ flex: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {t("products.cost")}
                                </Typography>
                                <TextField
                                    placeholder="0"
                                    type="number"
                                    value={values.price || ""}
                                    onChange={(e) =>
                                        setValues((s) => ({ ...s, price: Number(e.target.value) || 0 }))
                                    }
                                    fullWidth
                                    InputProps={{
                                        endAdornment: <Typography variant="caption" color="text.secondary">{suffix}</Typography>,
                                    }}
                                    sx={{
                                        "& input[type=number]": {
                                            MozAppearance: "textfield",
                                        },
                                        "& input[type=number]::-webkit-outer-spin-button": {
                                            WebkitAppearance: "none",
                                            margin: 0,
                                        },
                                        "& input[type=number]::-webkit-inner-spin-button": {
                                            WebkitAppearance: "none",
                                            margin: 0,
                                        },
                                    }}
                                />
                            </Stack>
                            <Stack spacing={0.5} sx={{ flex: 1 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {t("products.stock")}
                                </Typography>
                                <TextField
                                    placeholder="0"
                                    type="number"
                                    value={values.stock || ""}
                                    onChange={(e) =>
                                        setValues((s) => ({ ...s, stock: Number(e.target.value) || 0 }))
                                    }
                                    fullWidth
                                    InputProps={{
                                        endAdornment: <Typography variant="caption" color="text.secondary">{t("products.pieceUnit")}</Typography>,
                                    }}
                                    sx={{
                                        "& input[type=number]": {
                                            MozAppearance: "textfield",
                                        },
                                        "& input[type=number]::-webkit-outer-spin-button": {
                                            WebkitAppearance: "none",
                                            margin: 0,
                                        },
                                        "& input[type=number]::-webkit-inner-spin-button": {
                                            WebkitAppearance: "none",
                                            margin: 0,
                                        },
                                    }}
                                />
                            </Stack>
                        </Stack>

                        {/* Description */}
                        <Stack spacing={0.5}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {t("products.description")}
                            </Typography>
                            <TextField
                                placeholder={t("products.addDescriptionOptional")}
                                value={values.description || ""}
                                onChange={(e) => setValues((s) => ({ ...s, description: e.target.value }))}
                                fullWidth
                                multiline
                                rows={3}
                            />
                        </Stack>

                        {/* Infusion Toggle */}
                        <Paper
                            elevation={0}
                            variant="outlined"
                            sx={{
                                p: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between"
                            }}
                        >
                            <Stack direction="row" spacing={1} alignItems="center">
                                <InfoOutlinedIcon fontSize="small" color="action" />
                                <Typography variant="body2">{t("products.infusion")}</Typography>
                            </Stack>
                            <Tabs
                                value={values.is_infusion ? 0 : 1}
                                onChange={(_, v) =>
                                    setValues((s) => ({ ...s, is_infusion: v === 0 }))
                                }
                                sx={{ minHeight: 32 }}
                                TabIndicatorProps={{ style: { display: "none" } }}
                            >
                                <Tab
                                    label={t("products.yes")}
                                    sx={(theme) => ({ ...toggleTabStyles(theme, theme.palette.primary.main), minHeight: 32, py: 0, px: 2 })}
                                />
                                <Tab
                                    label={t("products.no")}
                                    sx={(theme) => ({ ...toggleTabStyles(theme, theme.palette.action.disabledBackground), minHeight: 32, py: 0, px: 2, '&.Mui-selected': { bgcolor: 'action.selected', color: 'text.primary' } })}
                                />
                            </Tabs>
                        </Paper>

                    </Stack>
                </Box>
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <Stack direction="row" gap={1} justifyContent="flex-end">
                        <Button onClick={onClose} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={busy || !values.name?.trim()}
                        >
                            {busy ? (
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <CircularProgress size={18} />
                                    <span>{t("common.saving")}</span>
                                </Stack>
                            ) : (
                                t("common.save")
                            )}
                        </Button>
                    </Stack>
                </Box>
            </Box>
        </Drawer>
    );
};
