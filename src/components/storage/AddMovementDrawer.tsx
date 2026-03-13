
import React, { useEffect, useState } from "react";
import {
    Box,
    Button,
    Stack,
    TextField,
    Typography,
    Drawer,
    IconButton,
    Divider,
    Autocomplete,
} from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { StockItem } from "../../services/warehouse";

// CSS to hide spin buttons
const noSpinnersSx = {
    '& input[type=number]': {
        MozAppearance: 'textfield'
    },
    '& input[type=number]::-webkit-outer-spin-button': {
        WebkitAppearance: 'none',
        margin: 0
    },
    '& input[type=number]::-webkit-inner-spin-button': {
        WebkitAppearance: 'none',
        margin: 0
    }
};

export type MovementProductOption = {
    id: string;
    label: string;
};

interface AddMovementDrawerProps {
    open: boolean;
    onClose: () => void;
    product: StockItem | null;
    mode: "in" | "out";
    onConfirm: (quantity: number, comment?: string, selectedProduct?: MovementProductOption | null, amount?: number) => Promise<void>;
    availableProducts?: MovementProductOption[]; // Simple list { label: string, id: string }
}

export const AddMovementDrawer: React.FC<AddMovementDrawerProps> = ({
    open,
    onClose,
    product,
    mode,
    onConfirm,
    availableProducts = []
}) => {
    const [quantity, setQuantity] = useState<string>("");
    const [amount, setAmount] = useState<string>("");
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<MovementProductOption | null>(null);

    useEffect(() => {
        if (open) {
            setQuantity("");
            setAmount("");
            setComment("");
            setLoading(false);
            setSelectedProduct(null);
        }
    }, [open, product]);

    const handleSubmit = async () => {
        const qty = parseFloat(quantity);
        const amt = parseFloat(amount);
        if (isNaN(qty) || qty <= 0) return;
        if (isNaN(amt) || amt <= 0) return;

        // Validate product selection if adding new
        if (!product && !selectedProduct) return;

        try {
            setLoading(true);
            await onConfirm(qty, comment, selectedProduct, amt);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getTitle = () => {
        if (!product && mode === 'in') return "Приход нового товара";
        switch (mode) {
            case "in": return "Приход товара";
            case "out": return "Списание товара";
            default: return "";
        }
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={loading ? undefined : onClose}
            PaperProps={{ sx: { width: { xs: 320, sm: 480, md: 520 }, maxWidth: "100vw", display: "flex", flexDirection: "column" } }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 2,
                    py: 1,
                }}
            >
                <Typography variant="h6">{getTitle()}</Typography>
                <IconButton onClick={loading ? undefined : onClose} aria-label="Закрыть">
                    <CloseOutlined />
                </IconButton>
            </Box>
            <Divider />

            <Stack
                spacing={3}
                sx={{
                    p: 3,
                    flex: 1,
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    '&::-webkit-scrollbar': {
                        display: 'none',
                    },
                }}
            >

                {/* Product Info Readonly or Selector */}
                {product ? (
                    <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>Товар</Typography>
                        <Typography variant="body1" fontWeight={500}>{product.product_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Текущий остаток: {product.quantity} {product.product_unit}
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Выберите товар
                        </Typography>
                        <Autocomplete<MovementProductOption, false, false, false>
                            options={availableProducts}
                            getOptionLabel={(option) => option.label || ""}
                            value={selectedProduct}
                            onChange={(_, newValue) => setSelectedProduct(newValue)}
                            renderInput={(params) => <TextField {...params} placeholder="Поиск товара..." />}
                            noOptionsText="Товар не найден"
                        />
                    </Stack>
                )}

                <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Количество
                    </Typography>
                    <Box
                        sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            bgcolor: 'background.paper',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: 40,
                        }}
                    >
                        <Button
                            size="small"
                            onClick={() => {
                                const current = parseFloat(quantity) || 0;
                                const newVal = Math.max(0, current - 1);
                                setQuantity(newVal === 0 ? "" : String(newVal));
                            }}
                            sx={{ minWidth: 32, px: 0.5, minHeight: 34 }}
                        >
                            −
                        </Button>
                        <TextField
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            size="small"
                            autoFocus={!!product}
                            placeholder="0"
                            error={!quantity || parseFloat(quantity) <= 0}
                            // helperText removed inside the small box to avoid layout break, validation is visual via error color or buttons
                            inputProps={{
                                style: { textAlign: 'center', padding: '8px 4px' },
                                min: 0
                            }}
                            sx={{
                                flex: 1,
                                ...noSpinnersSx,
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': { border: 'none' }
                                }
                            }}
                        />
                        <Button
                            size="small"
                            onClick={() => {
                                const current = parseFloat(quantity) || 0;
                                setQuantity(String(current + 1));
                            }}
                            sx={{ minWidth: 32, px: 0.5, minHeight: 34 }}
                        >
                            +
                        </Button>
                    </Box>
                    {(!quantity || parseFloat(quantity) <= 0) && (
                        <Typography variant="caption" color="error">
                            Обязательное поле
                        </Typography>
                    )}
                </Stack>

                <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {mode === "in" ? "Сумма закупки" : "Сумма списания"}
                    </Typography>
                    <TextField
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        fullWidth
                        required
                        placeholder="0"
                        error={!amount || parseFloat(amount) <= 0}
                        helperText={(!amount || parseFloat(amount) <= 0) ? "Обязательное поле" : ""}
                        InputProps={{
                            endAdornment: (
                                <Typography variant="body2" color="text.secondary">
                                    сом
                                </Typography>
                            ),
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

                <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Комментарий
                    </Typography>
                    <TextField
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                        required
                        placeholder={mode === "out" ? "Укажите причину списания (обязательно)" : "Укажите источник или комментарий (обязательно)"}
                        error={!comment.trim()}
                    />
                </Stack>

            </Stack>
            <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={handleSubmit}
                    disabled={
                        loading ||
                        !quantity ||
                        parseFloat(quantity) <= 0 ||
                        !amount ||
                        parseFloat(amount) <= 0 ||
                        !comment.trim() ||
                        (!product && !selectedProduct)
                    }
                >
                    {loading ? "Сохранение..." : "Подтвердить"}
                </Button>
            </Box>
        </Drawer>
    );
};
