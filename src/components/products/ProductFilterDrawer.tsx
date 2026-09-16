import React from "react";
import { useTranslation } from "react-i18next";
import AppAutocomplete from "../../components/ui/AppAutocomplete";
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Divider,
    Stack,
    TextField,
    MenuItem,
    Button
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export type ProductFilters = {
    category: string | null;
    saleStatus: "all" | "active" | "inactive";
    stockStatus: "all" | "in_stock" | "out_of_stock";
};

type Props = {
    open: boolean;
    onClose: () => void;
    filters: ProductFilters;
    onApply: (newFilters: ProductFilters) => void;
    onReset: () => void;
    availableCategories: string[];
};

const ProductFilterDrawer: React.FC<Props> = ({
    open,
    onClose,
    filters,
    onApply,
    onReset,
    availableCategories
}) => {
    const { t } = useTranslation();
    const [localFilters, setLocalFilters] = React.useState<ProductFilters>(filters);

    // Sync local state when drawer opens or filters change externally
    React.useEffect(() => {
        if (open) {
            setLocalFilters(filters);
        }
    }, [open, filters]);

    const handleChange = (field: keyof ProductFilters, value: any) => {
        setLocalFilters((prev) => ({ ...prev, [field]: value }));
    };

    const handleApply = () => {
        onApply(localFilters);
        onClose();
    };

    const handleReset = () => {
        onReset();
        onClose();
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: { width: { xs: 320, sm: 480, md: 520 }, maxWidth: "100vw" }
}}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2 }}>
                <Typography variant="h6">{t("common.filters")}</Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </Box>
            <Divider />

            <Box
                sx={{
                    p: 2,
                    flex: 1,
                    overflowY: "auto",
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    '&::-webkit-scrollbar': {
                        display: 'none'
}
}}
            >
                <Stack spacing={3}>
                    {/* Category Filter */}
                    <AppAutocomplete
                        options={availableCategories}
                        value={localFilters.category}
                        onChange={(_, newValue) => handleChange("category", newValue)}
                        renderInput={(params) => (
                            <TextField {...params} label={t("expenses.category")} placeholder={t("expenses.allCategories")} />
                        )}
                        noOptionsText={t("products.noCategoriesFilter")}
                        isOptionEqualToValue={(option, value) => option === value}
                    />

                    {/* Sale Status */}
                    <TextField
                        select
                        label={t("products.saleStatus")}
                        value={localFilters.saleStatus}
                        onChange={(e) => handleChange("saleStatus", e.target.value)}
                        fullWidth
                    >
                        <MenuItem value="all">{t("common.all")}</MenuItem>
                        <MenuItem value="active">{t("products.forSale")}</MenuItem>
                        <MenuItem value="inactive">{t("products.discontinued")}</MenuItem>
                    </TextField>

                    {/* Stock Status */}
                    <TextField
                        select
                        label={t("products.stockAvailability")}
                        value={localFilters.stockStatus}
                        onChange={(e) => handleChange("stockStatus", e.target.value)}
                        fullWidth
                    >
                        <MenuItem value="all">{t("products.notImportant")}</MenuItem>
                        <MenuItem value="in_stock">{t("products.inStock")}</MenuItem>
                        <MenuItem value="out_of_stock">{t("products.outOfStock")}</MenuItem>
                    </TextField>
                </Stack>
            </Box>

            <Divider />
            <Box sx={{ p: 2, display: "flex", gap: 2 }}>
                <Button variant="outlined" fullWidth onClick={handleReset}>
                    {t("common.reset")}
                </Button>
                <Button variant="contained" fullWidth onClick={handleApply}>
                    {t("common.apply")}
                </Button>
            </Box>
        </Drawer>
    );
};

export default ProductFilterDrawer;
