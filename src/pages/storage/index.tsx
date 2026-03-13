
import React from "react";
import {
    Box,
    Grid2,
    useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNotification } from "@refinedev/core";
import { supabase } from "../../utility/supabaseClient";

import { PageHeader, AppBottomSheet } from "../../components/ui";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
    getInventory,
    getStockMovements,
    createStockMovement,
    StockItem,
    StockMovement,
    getWarehouses
} from "../../services/warehouse";
import { getProducts } from "../../services/products";

// Components
import { StockList } from "../../components/storage/StockList";
import { StockDetails } from "../../components/storage/StockDetails";
import { AddMovementDrawer } from "../../components/storage/AddMovementDrawer";

const StoragePage: React.FC = () => {
    usePageTitle("Движение товара"); // User asked to rename
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const { open: notify } = useNotification();

    // State
    const [stock, setStock] = React.useState<StockItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState("");

    const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);
    const [reloadTick, setReloadTick] = React.useState(0);

    // Details State
    const [movements, setMovements] = React.useState<StockMovement[]>([]);
    const [loadingMovements, setLoadingMovements] = React.useState(false);

    // Drawer State
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [drawerMode, setDrawerMode] = React.useState<"in" | "out">("in");

    // All Products for Selector
    const [availableProducts, setAvailableProducts] = React.useState<{ id: string, label: string }[]>([]);

    // Fetch Inventory
    const fetchInventory = React.useCallback(async () => {
        try {
            setLoading(true);
            const data = await getInventory(); // Fetches all inventory? Or just primary? API default fetches all.
            setStock(data);
            return data;
        } catch (e) {
            console.error(e);
            notify?.({ type: "error", message: "Ошибка загрузки склада" });
            return [];
        } finally {
            setLoading(false);
        }
    }, [notify]);

    // Fetch Products for dropdown
    const fetchProductsForSelector = React.useCallback(async () => {
        try {
            const prods = await getProducts();
            setAvailableProducts(prods.map(p => ({ id: p.sellable_item_id, label: p.name })));
        } catch (e) { console.error("Failed to load products for selector", e); }
    }, []);

    React.useEffect(() => {
        fetchInventory();
        fetchProductsForSelector();
    }, [fetchInventory, fetchProductsForSelector, reloadTick]);

    // Fetch Movements when Item Selected
    React.useEffect(() => {
        if (selectedItem) {
            const loadMovements = async () => {
                try {
                    setLoadingMovements(true);
                    const data = await getStockMovements(selectedItem.product_id, selectedItem.warehouse_id);
                    setMovements(data);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingMovements(false);
                }
            };
            loadMovements();
        } else {
            setMovements([]);
        }
    }, [selectedItem, reloadTick]);

    // Auto-select first item on desktop
    React.useEffect(() => {
        if (!isMobile && stock.length > 0 && !selectedItem && !drawerOpen) {
            setSelectedItem(stock[0]);
        }
    }, [isMobile, stock, selectedItem, drawerOpen]);


    // Actions
    const handleOpenDrawer = (mode: "in" | "out") => {
        setDrawerMode(mode);
        setDrawerOpen(true);
    };

    const handleAddClick = () => {
        // Clear selection to trigger "New Item" mode in Drawer
        setSelectedItem(null);
        handleOpenDrawer('in');
    };

    const handleConfirmMovement = async (qty: number, _comment?: string, selectedProd?: any, amount?: number) => {
        const targetProduct = selectedItem ? selectedItem : (selectedProd ? { product_id: selectedProd.id, quantity: 0 } : null);

        if (!targetProduct) return;

        // Ensure we have a warehouse ID. If new item, fetch primary warehouse.
        let warehouseId = selectedItem?.warehouse_id;
        if (!warehouseId) {
            const warehouses = await getWarehouses();
            warehouseId = warehouses.find(w => w.is_primary)?.id || warehouses[0]?.id;
        }

        if (!warehouseId) {
            notify?.({ type: 'error', message: 'Склад не найден' });
            return;
        }

        try {
            let finalQty = qty;

            // Map Drawer Mode (UI) to DB Enum (Schema)
            let finalType: StockMovement['move_type'] = 'receipt';


            if (drawerMode === 'out') {
                finalQty = -qty; // Negative for outgoing
                finalType = 'consumption';
            } else {
                // mode === 'in'
                finalType = 'receipt';
            }

            await createStockMovement({
                warehouse_id: warehouseId,
                product_id: targetProduct.product_id || (targetProduct as any).id,
                quantity: finalQty,
                move_type: finalType,
                unit_cost: amount,
                comment: _comment,
                // reference ...
            });

            notify?.({ type: 'success', message: 'Успешно' });

            // Refresh
            const data = await fetchInventory();

            // Find and update the selected item with new data
            if (data && data.length > 0) {
                const pId = targetProduct.product_id || (targetProduct as any).id || (selectedProd?.id);
                const updated = data.find(i => i.product_id === pId);
                if (updated) {
                    setSelectedItem(updated);
                }
            }

        } catch (e) {
            console.error(e);
            notify?.({ type: 'error', message: 'Ошибка сохранения' });
        }
    };

    // REALTIME: Подписка на изменения склада и движений товара
    React.useEffect(() => {
        const channel = supabase
            .channel("storage-realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "StockMovements" },
                () => {
                    console.log("Realtime: StockMovements changed, reloading...");
                    setReloadTick(t => t + 1);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "Inventory" },
                () => {
                    console.log("Realtime: Inventory changed, reloading...");
                    setReloadTick(t => t + 1);
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "Warehouses" },
                () => {
                    console.log("Realtime: Warehouses changed, reloading...");
                    setReloadTick(t => t + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);


    // Filtered list
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
                title="Движение товара"
                showTitle={false} // Hidden as per design
                showSearch
                searchVal={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Поиск по статусу..."
                onAdd={handleAddClick}
                addButtonText="Добавить товар" // Or "Operation"
            />

            <Box sx={{ px: 2, pb: 4, pt: 1, flex: 1, overflow: "hidden" }}>
                <Grid2 container spacing={2} sx={{ height: "100%" }}>
                    {/* List */}
                    <Grid2 size={{ xs: 12, md: 5 }} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        <StockList
                            stock={filteredStock}
                            selectedItem={selectedItem}
                            onSelect={setSelectedItem}
                            loading={loading}
                        />
                    </Grid2>

                    {/* Details Desktop */}
                    {!isMobile && (
                        <Grid2 size={{ xs: 12, md: 7 }} sx={{ height: "100%" }}>
                            <StockDetails
                                item={selectedItem}
                                movements={movements}
                                loadingMovements={loadingMovements}
                                onAddStock={() => handleOpenDrawer('in')}
                                onRemoveStock={() => handleOpenDrawer('out')}
                            />
                        </Grid2>
                    )}
                </Grid2>
            </Box>

            {/* Drawers */}
            <AddMovementDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                product={selectedItem}
                mode={drawerMode}
                onConfirm={handleConfirmMovement}
                availableProducts={availableProducts}
            />

            {/* Mobile Sheet */}
            {isMobile && (
                <AppBottomSheet
                    open={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                >
                    {selectedItem && (
                        <Box sx={{ p: 2 }}>
                            <StockDetails
                                item={selectedItem}
                                movements={movements}
                                loadingMovements={loadingMovements}
                                onAddStock={() => handleOpenDrawer('in')}
                                onRemoveStock={() => handleOpenDrawer('out')}
                            />
                        </Box>
                    )}
                </AppBottomSheet>
            )}

        </Box>
    );
};

export default StoragePage;
