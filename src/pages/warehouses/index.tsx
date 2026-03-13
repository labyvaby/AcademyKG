
import React from "react";
import {
    Box,
    Grid2,
    useMediaQuery,
    Drawer,
    Typography,
    IconButton,
    Divider,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useNotification } from "@refinedev/core";
import CloseIcon from "@mui/icons-material/Close";

import { PageHeader } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
    getInventory,
    getStockMovements,
    createStockMovement,
    getWarehouses,
    StockItem,
    StockMovement,
    Warehouse,
} from "../../services/warehouse";
import { getProducts } from "../../services/products";

// Components
import { StockList } from "../../components/storage/StockList";
import { StockDetails } from "../../components/storage/StockDetails";
import { AddMovementDrawer } from "../../components/storage/AddMovementDrawer";
import { WarehouseList } from "../../components/storage/WarehouseList";
import { AddWarehouseDrawer } from "../../components/storage/AddWarehouseDrawer";

const WarehousesPage: React.FC = () => {
    usePageTitle("Склад");
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const { open: notify } = useNotification();

    // Data State
    const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string | null>(null);
    const [stock, setStock] = React.useState<StockItem[]>([]);
    const [loadingStock, setLoadingStock] = React.useState(false);
    const [loadingWarehouses, setLoadingWarehouses] = React.useState(true);

    // Filter
    const [searchQuery, setSearchQuery] = React.useState("");

    // Details / Selection
    const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null); // For Details Drawer
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);

    // Movement History State (for Details Drawer)
    const [movements, setMovements] = React.useState<StockMovement[]>([]);
    const [loadingMovements, setLoadingMovements] = React.useState(false);

    // Drawers State
    const [movementDrawerOpen, setMovementDrawerOpen] = React.useState(false);
    const [movementMode, setMovementMode] = React.useState<"in" | "out">("in");

    const [warehouseDrawerOpen, setWarehouseDrawerOpen] = React.useState(false);
    const [editingWarehouse, setEditingWarehouse] = React.useState<Warehouse | null>(null);

    // All Products for Selector (for adding new items)
    const [availableProducts, setAvailableProducts] = React.useState<{ id: string, label: string }[]>([]);

    // 1. Fetch Warehouses & Products
    const loadInitialData = React.useCallback(async () => {
        try {
            setLoadingWarehouses(true);
            const [ws, prods] = await Promise.all([
                getWarehouses(),
                getProducts()
            ]);
            setWarehouses(ws);
            setAvailableProducts(prods.map(p => ({ id: p.sellable_item_id, label: p.name })));

            // Auto-select primary or first
            if (ws.length > 0 && !selectedWarehouseId) {
                const primary = ws.find(w => w.is_primary) || ws[0];
                setSelectedWarehouseId(primary.id);
            }
        } catch (e) {
            console.error(e);
            notify?.({ type: "error", message: "Ошибка загрузки данных" });
        } finally {
            setLoadingWarehouses(false);
        }
    }, [notify, selectedWarehouseId]);

    React.useEffect(() => {
        loadInitialData();
    }, []); // Run once

    // 2. Fetch Stock when Warehouse changes
    const fetchStock = React.useCallback(async () => {
        if (!selectedWarehouseId) return;
        try {
            setLoadingStock(true);
            const data = await getInventory(selectedWarehouseId);
            setStock(data);
        } catch (e) {
            console.error(e);
            notify?.({ type: "error", message: "Ошибка загрузки остатков" });
        } finally {
            setLoadingStock(false);
        }
    }, [selectedWarehouseId, notify]);

    React.useEffect(() => {
        fetchStock();
    }, [fetchStock]);

    // 3. Fetch Movements when Item Selected (for Details Drawer)
    React.useEffect(() => {
        if (selectedItem && isDetailsOpen) {
            const loadMoves = async () => {
                try {
                    setLoadingMovements(true);
                    const data = await getStockMovements(selectedItem.product_id, selectedItem.warehouse_id);
                    setMovements(data);
                } catch (e) { console.error(e); } finally { setLoadingMovements(false); }
            };
            loadMoves();
        }
    }, [selectedItem, isDetailsOpen]);


    // Handlers
    const handleAddWarehouse = () => {
        setEditingWarehouse(null);
        setWarehouseDrawerOpen(true);
    };

    const handleEditWarehouse = (w: Warehouse) => {
        setEditingWarehouse(w);
        setWarehouseDrawerOpen(true);
    };

    const handleStockClick = (item: StockItem) => {
        setSelectedItem(item);
        setIsDetailsOpen(true);
    };

    const handleAddMovementClick = (mode: "in" | "out") => {
        setMovementMode(mode);
        setMovementDrawerOpen(true);
    }; // From Details Drawer

    const handleGlobalAddStock = () => {
        setSelectedItem(null); // Adding raw new item
        setMovementMode("in");
        setMovementDrawerOpen(true);
    };

    const handleConfirmMovement = async (qty: number, comment?: string, selectedProd?: { id: string } | null, amount?: number) => {
        // Параметр comment сейчас не используется в логике,
        // но приходит из UI — помечаем как использованный, чтобы пройти строгую проверку TS.
        void comment;
        const targetProduct: StockItem | { product_id: string; quantity: number } | null =
            selectedItem ? selectedItem : (selectedProd ? { product_id: selectedProd.id, quantity: 0 } : null);
        if (!targetProduct) return;

        // Ensure warehouse ID
        const wId = selectedItem?.warehouse_id || selectedWarehouseId;
        if (!wId) {
            notify?.({ type: 'error', message: 'Склад не выбран' });
            return;
        }

        try {
            let finalQty = qty;
            const finalType: StockMovement['move_type'] = movementMode === 'out' ? 'consumption' : 'receipt';
            if (movementMode === 'out') finalQty = -qty;

            await createStockMovement({
                warehouse_id: wId,
                product_id: targetProduct.product_id,
                quantity: finalQty,
                move_type: finalType,
                reference_table: 'manual', // or comment
                unit_cost: amount,
            });

            notify?.({ type: 'success', message: 'Успешно' });

            // Refresh
            fetchStock();

            if (isDetailsOpen && selectedItem) {
                const moves = await getStockMovements(targetProduct.product_id, wId);
                setMovements(moves);
            }
        } catch (e) {
            console.error(e);
            notify?.({ type: 'error', message: 'Ошибка сохранения' });
            throw e;
        }
    };

    // Post-Fetch stock update selected item quantity if open
    React.useEffect(() => {
        if (selectedItem && stock.length > 0) {
            const updated = stock.find(s => s.product_id === selectedItem.product_id);
            if (updated) setSelectedItem(updated);
        }
    }, [stock]);

    // Filter
    const filteredStock = React.useMemo(() => {
        if (!searchQuery) return stock;
        const q = searchQuery.toLowerCase();
        return stock.filter(i =>
            i.product_name?.toLowerCase().includes(q) ||
            i.product_barcode?.includes(q)
        );
    }, [stock, searchQuery]);


    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <PageHeader
                title="Склад"
                showTitle={false}
                showSearch
                searchVal={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Поиск товара..."
                onAdd={handleGlobalAddStock}
                addButtonText="Приход товара"
            />

            <Box sx={(theme) => ({ px: theme.appLayout.page.paddingX, pb: theme.appLayout.page.paddingY })}>
                <Grid2 container spacing={2} sx={{ flex: 1, minHeight: 0 }}>

                    {/* Left: Warehouses */}
                    <Grid2
                        size={{ xs: 12, md: 2.5 }}
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
                        <WarehouseList
                            warehouses={warehouses}
                            selectedId={selectedWarehouseId}
                            onSelect={setSelectedWarehouseId}
                            onAdd={handleAddWarehouse}
                            onEdit={handleEditWarehouse}
                            loading={loadingWarehouses}
                        />
                    </Grid2>

                    {/* Center: Stocks List */}
                    <Grid2
                        size={{ xs: 12, md: 4.5 }}
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
                        <StockList
                            stock={filteredStock}
                            selectedItem={selectedItem}
                            onSelect={handleStockClick}
                            loading={loadingStock}
                            warehouseName={warehouses.find(w => w.id === selectedWarehouseId)?.name}
                            warehouseAddress={warehouses.find(w => w.id === selectedWarehouseId)?.address}
                        />
                    </Grid2>

                    {/* Right: Stock Details (Desktop only) */}
                    {!isMobile && (
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
                            <StockDetails
                                item={selectedItem}
                                movements={movements}
                                loadingMovements={loadingMovements}
                                onAddStock={() => handleAddMovementClick('in')}
                                onRemoveStock={() => handleAddMovementClick('out')}
                                warehouseName={warehouses.find(w => w.id === selectedItem?.warehouse_id)?.name}
                                warehouseAddress={warehouses.find(w => w.id === selectedItem?.warehouse_id)?.address}
                            />
                        </Grid2>
                    )}
                </Grid2>
            </Box>

            {/* Warehouse Management Drawer */}
            <AddWarehouseDrawer
                open={warehouseDrawerOpen}
                onClose={() => setWarehouseDrawerOpen(false)}
                onSuccess={loadInitialData}
                editItem={editingWarehouse}
            />

            {/* Add/Remove Movement Drawer */}
            <AddMovementDrawer
                open={movementDrawerOpen}
                onClose={() => setMovementDrawerOpen(false)}
                product={selectedItem}
                mode={movementMode}
                onConfirm={handleConfirmMovement}
                availableProducts={availableProducts}
            />

            {/* Stock Details Drawer (Mobile only) */}
            {isMobile && (
                <Drawer
                    anchor="right"
                    open={isDetailsOpen}
                    onClose={() => setIsDetailsOpen(false)}
                    PaperProps={{ sx: { width: { xs: "100%", sm: 500 }, maxWidth: "100%" } }}
                >
                    <Box sx={{ p: 0, height: "100%" }}>
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6">Детали товара</Typography>
                            <IconButton onClick={() => setIsDetailsOpen(false)}><CloseIcon /></IconButton>
                        </Box>
                        <Divider />
                        <Box sx={{ p: 2, height: 'calc(100% - 60px)' }}>
                            <StockDetails
                                item={selectedItem}
                                movements={movements}
                                loadingMovements={loadingMovements}
                                onAddStock={() => handleAddMovementClick('in')}
                                onRemoveStock={() => handleAddMovementClick('out')}
                                warehouseName={warehouses.find(w => w.id === selectedItem?.warehouse_id)?.name}
                                warehouseAddress={warehouses.find(w => w.id === selectedItem?.warehouse_id)?.address}
                            />
                        </Box>
                    </Box>
                </Drawer>
            )}
        </Box>
    );
};

export default WarehousesPage;
