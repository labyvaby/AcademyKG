
import React, { useState, useEffect } from "react";
import {
    Box,
    Grid2,
    useMediaQuery,
    useTheme,
    Paper,
    Typography,
    Stack,
    List,
    ListItemButton,
    Button,
    TextField,
    MenuItem,
} from "@mui/material";
import { useNotification } from "@refinedev/core";
import type { Theme } from "@mui/material/styles";

import { PageHeader, AppBottomSheet } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useSimplePageCache } from "../../hooks/useSimplePageCache";
import { getSales, createSale, deleteSale, Sale, CreateSaleData } from "../../services/sales";
import { CreateSaleDrawer } from "../../components/sales/CreateSaleDrawer";
import { EditSaleDrawer } from "../../components/sales/EditSaleDrawer";
import { getProducts } from "../../services/products";
import { formatKGS } from "../../utility/format";
import { usePermissions } from "../../hooks/usePermissions";

// Components
import { SalesList } from "../../components/sales/SalesList";
import { SaleDetails } from "../../components/sales/SaleDetails";

const MONTH_NAMES = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const SalesPage: React.FC = () => {
    usePageTitle("Продажи");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const { open: notify } = useNotification();
    const { isAdmin, isRegistrator } = usePermissions();
    const canManageSales = isAdmin() || isRegistrator();

    // State
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Period Filter State
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Master-Detail State
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

    // Кеширование состояния страницы
    const { restoreState } = useSimplePageCache('sales-page', {
        sales,
        searchQuery,
        selectedYear,
        selectedMonth,
        selectedDate,
        selectedSale
    });

    // Create Drawer State
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [availableProducts, setAvailableProducts] = useState<{ id: string; label: string; price: number; image?: string; barcode?: string; is_active?: boolean }[]>([]);

    const fetchSales = React.useCallback(async () => {
        try {
            setLoading(true);
            const data = await getSales();
            setSales(data);
        } catch (e) {
            console.error(e);
            notify?.({ type: "error", message: "Ошибка загрузки продаж" });
        } finally {
            setLoading(false);
        }
    }, [notify]);

    const fetchProductsForSelector = React.useCallback(async () => {
        try {
            const prods = await getProducts();
            setAvailableProducts(prods.map(p => ({
                id: p.sellable_item_id,
                label: p.name,
                price: p.price || 0,
                image: p.image_url,
                barcode: p.barcode,
                is_active: p.is_for_sale
            })));
        } catch (e) { console.error("Failed to load products", e); }
    }, []);

    useEffect(() => {
        // Восстанавливаем состояние из кеша
        const cached = restoreState();
        if (cached) {
            setSales(cached.sales);
            setSearchQuery(cached.searchQuery);
            setSelectedYear(cached.selectedYear);
            setSelectedMonth(cached.selectedMonth);
            setSelectedDate(cached.selectedDate);
            setSelectedSale(cached.selectedSale);
            setLoading(false);
            fetchProductsForSelector(); // Продукты всегда загружаем
            return; // Пропускаем fetch продаж
        }

        // Загружаем данные только если нет кеша
        fetchSales();
        fetchProductsForSelector();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filter Sales
    const filteredSales = React.useMemo(() => {
        if (!searchQuery) return sales;
        const q = searchQuery.toLowerCase();
        return sales.filter(s =>
            s.id.toLowerCase().includes(q) ||
            s.patient_name?.toLowerCase().includes(q) ||
            s.lines?.some(l => l.product_name?.toLowerCase().includes(q))
        );
    }, [sales, searchQuery]);

    // Доступные годы
    const availableYears = React.useMemo(() => {
        const years = new Set<string>();
        for (const sale of filteredSales) {
            if (!sale.created_at) continue;
            const year = new Date(sale.created_at).getFullYear().toString();
            years.add(year);
        }
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [filteredSales]);

    type MonthOption = {
        value: string;
        monthIndex: number;
    };

    // Доступные месяцы (только с продажами) для выбранного года
    const availableMonths = React.useMemo<MonthOption[]>(() => {
        if (!selectedYear) return [];

        const monthMap = new Map<string, number>();

        for (const sale of filteredSales) {
            if (!sale.created_at) continue;
            const date = new Date(sale.created_at);
            const year = date.getFullYear().toString();
            if (year !== selectedYear) continue;

            const monthIndex = date.getMonth();
            const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, monthIndex);
            }
        }

        return Array.from(monthMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, monthIndex]) => ({ value, monthIndex }));
    }, [filteredSales, selectedYear]);

    // Period filtered sales
    const periodFilteredSales = React.useMemo(() => {
        if (!selectedYear && !selectedMonth && !selectedDate) return filteredSales;

        return filteredSales.filter((sale) => {
            if (!sale.created_at) return false;
            const date = new Date(sale.created_at);
            const year = date.getFullYear().toString();

            if (selectedYear && year !== selectedYear) return false;

            if (selectedMonth) {
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const yearMonth = `${year}-${month}`;
                if (yearMonth !== selectedMonth) return false;

                if (selectedDate) {
                    const day = String(date.getDate()).padStart(2, "0");
                    const fullDate = `${year}-${month}-${day}`;
                    if (fullDate !== selectedDate) return false;
                }
            }

            return true;
        });
    }, [filteredSales, selectedYear, selectedMonth, selectedDate]);

    // Group by day
    const groupedByDay = React.useMemo(() => {
        const dayMap = new Map<string, Sale[]>();

        const salesForDayList = filteredSales.filter((sale) => {
            if (!sale.created_at) return false;
            const date = new Date(sale.created_at);
            const year = date.getFullYear().toString();

            if (selectedYear && year !== selectedYear) return false;

            if (selectedMonth) {
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const yearMonth = `${year}-${month}`;
                if (yearMonth !== selectedMonth) return false;
            }

            return true;
        });

        for (const sale of salesForDayList) {
            if (!sale.created_at) continue;
            const date = new Date(sale.created_at);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const dayKey = `${year}-${month}-${day}`;

            if (!dayMap.has(dayKey)) dayMap.set(dayKey, []);
            dayMap.get(dayKey)!.push(sale);
        }

        return Array.from(dayMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, sls]) => ({
                date,
                sales: sls,
                total: sls.reduce((sum, s) => sum + (s.total_amount ?? 0), 0),
            }));
    }, [filteredSales, selectedYear, selectedMonth]);

    // Auto-select first sale on desktop if nothing selected
    useEffect(() => {
        if (!isMobile && !selectedSale && periodFilteredSales.length > 0) {
            setSelectedSale(periodFilteredSales[0]);
        }
    }, [periodFilteredSales, isMobile, selectedSale]);

    // Edit Drawer State
    const [editDrawerOpen, setEditDrawerOpen] = useState(false);
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);

    const handleCreateSale = async (data: CreateSaleData) => {
        try {
            await createSale(data);
            notify?.({ type: 'success', message: 'Продажа успешно создана' });
            setDrawerOpen(false);
            fetchSales();
        } catch (e) {
            console.error(e);
            notify?.({ type: 'error', message: 'Ошибка при создании продажи' });
        }
    };

    const handleDeleteSale = async (sale: Sale) => {
        try {
            await deleteSale(sale.id);
            notify?.({ type: 'success', message: 'Продажа удалена' });
            if (selectedSale?.id === sale.id) setSelectedSale(null);
            fetchSales();
        } catch (e) {
            console.error(e);
            notify?.({ type: 'error', message: 'Не удалось удалить продажу' });
        }
    };

    const handleEditSale = (sale: Sale) => {
        setSaleToEdit(sale);
        setEditDrawerOpen(true);
    };

    const handleUpdateSuccess = () => {
        fetchSales();
        // Recalculate or re-fetch details if needed, but fetchSales updates the list
        // And if selectedSale is the one edited, we might want to update it.
        // Simple way: re-select it from new list or let the effect handle it?
        // Let's just re-fetch.
    };

    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <PageHeader
                title="Продажи"
                showTitle={false}
                showSearch
                searchVal={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Поиск продаж..."
                onAdd={canManageSales ? () => setDrawerOpen(true) : undefined}
                addButtonText="Продажа"
            />

            <Box sx={(theme) => ({ px: theme.appLayout.page.paddingX, pb: theme.appLayout.page.paddingY })}>
                <Grid2 container spacing={2} sx={{ flex: 1, minHeight: 0 }}>

                    {/* Period Filter Column */}
                    <Grid2
                        size={{ xs: 12, md: 2 }}
                        sx={(theme: Theme) => ({
                            position: { md: "sticky" },
                            top: { md: theme.spacing(2) },
                            alignSelf: "flex-start",
                            height: {
                                xs: "auto",
                                md: "100%",
                            },
                            display: "flex",
                            flexDirection: "column",
                            overflow: { xs: "visible", md: "hidden" },
                        })}
                    >
                        <Paper
                            elevation={0}
                            variant="outlined"
                            sx={{
                                height: { xs: "auto", md: "100%" },
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    Период
                                </Typography>
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setSelectedYear(null);
                                        setSelectedMonth(null);
                                        setSelectedDate(null);
                                    }}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Все продажи
                                </Button>
                            </Box>

                            <Box sx={{ overflowY: "auto", flex: 1, p: 2 }}>
                                <Stack spacing={2}>
                                    {/* Dropdown года */}
                                    <Stack spacing={0.5}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            Год
                                        </Typography>
                                        <TextField
                                            select
                                            size="small"
                                            fullWidth
                                            value={selectedYear ?? ""}
                                            onChange={(event) => {
                                                const yearValue = event.target.value;
                                                const nextYear = typeof yearValue === "string" && yearValue.length > 0 ? yearValue : null;
                                                setSelectedYear(nextYear);
                                                setSelectedMonth(null);
                                                setSelectedDate(null);
                                            }}
                                            SelectProps={{ displayEmpty: true }}
                                        >
                                            <MenuItem value="">
                                                <Typography variant="body2" color="text.secondary">
                                                    Все годы
                                                </Typography>
                                            </MenuItem>
                                            {availableYears.map((year) => (
                                                <MenuItem key={year} value={year}>
                                                    {year}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Stack>

                                    {/* Dropdown месяца (только месяцы с продажами) */}
                                    {selectedYear && (
                                        <Stack spacing={0.5}>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                Месяц
                                            </Typography>
                                            <TextField
                                                select
                                                size="small"
                                                fullWidth
                                                value={selectedMonth ?? ""}
                                                onChange={(event) => {
                                                    const monthValue = event.target.value;
                                                    const nextMonth = typeof monthValue === "string" && monthValue.length > 0 ? monthValue : null;
                                                    setSelectedMonth(nextMonth);
                                                    setSelectedDate(null);
                                                }}
                                                SelectProps={{ displayEmpty: true }}
                                                disabled={availableMonths.length === 0}
                                            >
                                                <MenuItem value="">
                                                    <Typography variant="body2" color="text.secondary">
                                                        Все месяцы
                                                    </Typography>
                                                </MenuItem>
                                                {availableMonths.map((month) => (
                                                    <MenuItem key={month.value} value={month.value}>
                                                        {MONTH_NAMES[month.monthIndex]}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        </Stack>
                                    )}

                                    {/* Days */}
                                    {selectedMonth && (
                                        <Stack spacing={0.5}>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                День
                                            </Typography>
                                            <List dense sx={{ py: 0 }}>
                                                {groupedByDay.map((day) => (
                                                    <ListItemButton
                                                        key={day.date}
                                                        sx={{
                                                            borderRadius: 1,
                                                            mb: 0.5,
                                                            bgcolor: selectedDate === day.date ? "action.selected" : "transparent",
                                                        }}
                                                        onClick={() => setSelectedDate(day.date)}
                                                    >
                                                        <Typography variant="body2" sx={{ flex: 1 }}>
                                                            {new Date(day.date).toLocaleDateString("ru-RU")}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {formatKGS(day.total)}
                                                        </Typography>
                                                    </ListItemButton>
                                                ))}
                                            </List>
                                        </Stack>
                                    )}
                                </Stack>
                            </Box>
                        </Paper>
                    </Grid2>

                    {/* List Pane */}
                    <Grid2
                        size={{ xs: 12, md: 5 }}
                        sx={(theme: Theme) => ({
                            position: { md: "sticky" },
                            top: { md: theme.spacing(2) },
                            alignSelf: "flex-start",
                            height: {
                                xs: "auto",
                                md: "100%",
                            },
                            display: "flex",
                            flexDirection: "column",
                            overflow: { xs: "visible", md: "hidden" },
                        })}
                    >
                        <SalesList
                            sales={periodFilteredSales}
                            selectedSale={selectedSale}
                            onSelect={setSelectedSale}
                            loading={loading}
                        />
                    </Grid2>

                    {/* Details Pane (Desktop) */}
                    {!isMobile && (
                        <Grid2
                            size={{ xs: 12, md: 5 }}
                            sx={(theme: Theme) => ({
                                position: { md: "sticky" },
                                top: { md: theme.spacing(2) },
                                alignSelf: "flex-start",
                                height: {
                                    md: "100%",
                                },
                                display: "flex",
                                flexDirection: "column",
                                overflow: { xs: "visible", md: "hidden" },
                            })}
                        >
                            <Box
                                sx={{
                                    height: "100%",
                                    overflowY: "auto",
                                    pr: 0.5,
                                    '&::-webkit-scrollbar': { width: 8 },
                                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                                    '&::-webkit-scrollbar-thumb': {
                                        bgcolor: 'divider',
                                        borderRadius: 1,
                                        '&:hover': { bgcolor: 'action.disabled' }
                                    },
                                }}
                            >
                                <SaleDetails
                                    sale={selectedSale}
                                    onDelete={handleDeleteSale}
                                    onEdit={handleEditSale}
                                />
                            </Box>
                        </Grid2>
                    )}
                </Grid2>
            </Box>

            {/* Create Drawer */}
            <CreateSaleDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                availableProducts={availableProducts}
                onConfirm={handleCreateSale}
            />

            {/* Edit Drawer */}
            {saleToEdit && (
                <EditSaleDrawer
                    open={editDrawerOpen}
                    onClose={() => setEditDrawerOpen(false)}
                    sale={saleToEdit}
                    onUpdated={handleUpdateSuccess}
                    availableProducts={availableProducts}
                />
            )}  {/* Mobile Bottom Sheet for Details */}
            {isMobile && (
                <AppBottomSheet
                    open={!!selectedSale}
                    onClose={() => setSelectedSale(null)}
                >
                    <Box sx={{ p: 2 }}>
                        <SaleDetails
                            sale={selectedSale}
                            onDelete={handleDeleteSale}
                            onEdit={(s) => {
                                setSelectedSale(null); // Close sheet to show drawer
                                handleEditSale(s);
                            }}
                        />
                    </Box>
                </AppBottomSheet>
            )}

        </Box>
    );
};

export default SalesPage;
