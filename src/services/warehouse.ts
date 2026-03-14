import { apiFetch } from "../utility/apiClient";

export type Warehouse = {
    id: string;
    name: string;
    address?: string;
    is_primary: boolean;
    created_at: string;
};

export type StockItem = {
    warehouse_id: string;
    product_id: string;
    quantity: number;
    last_updated: string;
    // Joined fields
    product_name?: string;
    product_image?: string;
    product_barcode?: string;
    product_unit?: string;
    product_category?: string;
};

export type StockMovement = {
    id: string;
    warehouse_id: string;
    product_id: string;
    quantity: number;
    move_type: 'receipt' | 'consumption' | 'adjustment' | 'transfer_in' | 'transfer_out';
    created_at: string;
    created_by?: string; // uuid
    reference_id?: string;
    reference_table?: string; // 'Sales', 'Appointments' etc
    unit_cost?: number; // Cost price at the moment
    comment?: string;
    // Joined fields
    product_name?: string;
    user_name?: string; // created_by name
};

export const getWarehouses = async (): Promise<Warehouse[]> => {
    const res: any = await apiFetch("/api/v1/warehouses/");
    return (res?.data?.results ?? res?.results ?? (Array.isArray(res?.data) ? res.data : null) ?? (Array.isArray(res) ? res : [])) as Warehouse[];
};

export const getPrimaryWarehouseId = async () => {
    const warehouses = await getWarehouses() as Warehouse[];
    const primary = warehouses.find(w => w.is_primary);
    return primary?.id || warehouses[0]?.id || null;
};

export const getInventory = async (warehouseId?: string): Promise<StockItem[]> => {
    let url = "/api/v1/inventory/";
    if (warehouseId) {
        url += `?warehouse_id=${warehouseId}`;
    }
    const res: any = await apiFetch(url);
    return (res?.data?.results ?? res?.results ?? (Array.isArray(res?.data) ? res.data : null) ?? (Array.isArray(res) ? res : [])) as StockItem[];
};

export const getStockMovements = async (productId?: string, warehouseId?: string, limit = 50): Promise<StockMovement[]> => {
    const params = new URLSearchParams();
    if (productId) params.append("product_id", productId);
    if (warehouseId) params.append("warehouse_id", warehouseId);
    params.append("limit", limit.toString());

    const res: any = await apiFetch(`/api/v1/stock-movements/?${params.toString()}`);
    return (res?.data?.results ?? res?.results ?? (Array.isArray(res?.data) ? res.data : null) ?? (Array.isArray(res) ? res : [])) as StockMovement[];
};

type CreateMovementParams = {
    warehouse_id: string;
    product_id: string;
    quantity: number;
    move_type: StockMovement['move_type'];
    created_by?: string;
    reference_id?: string;
    reference_table?: string;
    unit_cost?: number;
    comment?: string;
};

export const createStockMovement = async (params: CreateMovementParams) => {
    if (params.quantity === 0) return;

    return await apiFetch("/api/v1/stock-movements/", {
        method: "POST",
        body: JSON.stringify(params)
    });
};

export const createWarehouse = async (name: string, address: string = "", is_primary: boolean = false) => {
    return await apiFetch("/api/v1/warehouses/", {
        method: "POST",
        body: JSON.stringify({ name, address, is_primary })
    });
};

export const updateWarehouse = async (id: string, data: { name?: string; address?: string; is_primary?: boolean }) => {
    return await apiFetch(`/api/v1/warehouses/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(data)
    });
};
