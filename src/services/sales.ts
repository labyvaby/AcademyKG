import { supabase } from "../utility/supabaseClient";
import { createStockMovement } from "./warehouse";

export type SaleLine = {
    id: string;
    sale_id: string;
    sellable_item_id: string;
    quantity: number;
    price_at_sale: number;
    total: number;
    // Joined
    product_name?: string;
    product_image?: string;
};

export type Sale = {
    id: string;
    patient_id?: string;
    status: string;
    comment?: string;
    created_at: string;
    paid_cash: number;
    paid_card: number;
    // Joined
    lines?: SaleLine[];
    patient_name?: string;
    patient_phone?: string;
    patient_avatar?: string;
    total_amount?: number;
};

export type CreateSaleData = {
    patient_id?: string;
    comment?: string;
    lines: {
        sellable_item_id: string;
        quantity: number;
        price: number;
    }[];
    // Опциональные поля для определения статуса оплаты
    cash?: number;
    card?: number;
    totalAmount?: number;
};

export const getSales = async () => {
    // We want to fetch sales, and their lines, and maybe patient info
    const { data: sales, error } = await supabase
        .from("Sales")
        .select(`
            *,
            Patients:patient_id (id, full_name, phone, photo_url),
            SaleLines (
                *,
                SellableItems (
                    type,
                    Products (name, image_url)
                )
            )
        `)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return sales.map((s: any) => ({
        ...s,
        patient_name: s.Patients?.full_name || "Анонимный покупатель",
        patient_phone: s.Patients?.phone || null,
        patient_avatar: s.Patients?.photo_url || null,
        lines: s.SaleLines?.map((l: any) => ({
            ...l,
            product_name: l.SellableItems?.Products?.name,
            product_image: l.SellableItems?.Products?.image_url
        })),
        total_amount: s.SaleLines?.reduce((acc: number, l: any) => acc + (l.total || 0), 0)
    })) as Sale[];
};

export const createSale = async (data: CreateSaleData) => {
    // Определяем статус на основе оплаты
    let status = 'open'; // По умолчанию - не оплачено

    if (data.cash !== undefined && data.card !== undefined && data.totalAmount !== undefined) {
        const totalPaid = (data.cash || 0) + (data.card || 0);
        const total = data.totalAmount;

        if (totalPaid >= total) {
            status = 'paid'; // Полностью оплачено
        } else if (totalPaid > 0) {
            status = 'partial'; // Частично оплачено
        }
        // Если totalPaid === 0, остается 'open'
    }

    // 1. Create Sale Header
    const { data: sale, error: saleError } = await supabase
        .from("Sales")
        .insert([{
            patient_id: data.patient_id || null,
            status: status, // Valid status: open, partial, paid, canceled
            comment: data.comment,
            paid_cash: data.cash || 0,
            paid_card: data.card || 0
        }])
        .select(`
            *,
            Patients:patient_id (id, full_name, phone, photo_url),
            SaleLines (
                *,
                SellableItems (
                    type,
                    Products (name, image_url)
                )
            )
        `)
        .single();

    if (saleError) throw saleError;
    if (!sale) throw new Error("Sale creation failed");

    // 2. Create Sale Lines
    const linesToInsert = data.lines.map(l => ({
        sale_id: sale.id,
        sellable_item_id: l.sellable_item_id,
        quantity: l.quantity,
        price_at_sale: l.price
        // total is generated, do not insert
    }));

    const { error: linesError } = await supabase
        .from("SaleLines")
        .insert(linesToInsert);

    if (linesError) {
        // Todo: Rollback sale? Supabase doesn't support easy rollback from here without RPC.
        // For now, we assume success or handle manually.
        console.error("Failed to create lines", linesError);
        throw linesError;
    }

    // 3. Deduct Stock
    // We need to fetch warehouse_id for each item?
    // Or assume primary warehouse.
    // Let's assume primary warehouse for all sales for simplicity in this MVP.
    // Ideally we should pick warehouse.
    const { data: warehouse } = await supabase
        .from("Warehouses")
        .select("id")
        .eq("is_primary", true)
        .single();

    const warehouseId = warehouse?.id;

    if (warehouseId) {
        // Fetch item types to ensure we only move stock for products
        const itemIds = data.lines.map(l => l.sellable_item_id);
        const { data: items } = await supabase
            .from("SellableItems")
            .select("id, type")
            .in("id", itemIds);

        const itemTypeMap = new Map(items?.map(i => [i.id, i.type]) || []);

        for (const line of data.lines) {
            if (itemTypeMap.get(line.sellable_item_id) === 'product') {
                // Use the Sale Price as the value for the stock movement
                // This aligns the "Sum" in history with the actual Sale amount.
                const totalCostForMovement = line.price * line.quantity;

                await createStockMovement({
                    warehouse_id: warehouseId,
                    product_id: line.sellable_item_id,
                    move_type: 'consumption',
                    quantity: -line.quantity,
                    reference_id: sale.id, // Explicit reference ID
                    reference_table: 'Sales', // Explicit reference table
                    unit_cost: totalCostForMovement
                });
            }
        }
    }

    const formattedSale: Sale = {
        ...sale,
        patient_name: sale.Patients?.full_name || "Анонимный покупатель",
        patient_phone: sale.Patients?.phone || null,
        patient_avatar: sale.Patients?.photo_url || null,
        lines: sale.SaleLines?.map((l: any) => ({
            ...l,
            product_name: l.SellableItems?.Products?.name,
            product_image: l.SellableItems?.Products?.image_url
        })),
        total_amount: sale.SaleLines?.reduce((acc: number, l: any) => acc + (l.total || 0), 0)
    };

    return formattedSale;
};

export const deleteSale = async (id: string) => {
    // 1. Get lines to revert stock
    const { data: sale } = await supabase
        .from("Sales")
        .select("*, SaleLines(*, SellableItems(type))")
        .eq("id", id)
        .single();

    if (sale && sale.SaleLines) {
        // Fetch warehouse
        const { data: warehouse } = await supabase
            .from("Warehouses")
            .select("id")
            .eq("is_primary", true)
            .single();
        
        const warehouseId = warehouse?.id;

        if (warehouseId) {
            // Safe fetch of types
            const itemIds = sale.SaleLines.map((l: any) => l.sellable_item_id);
            const { data: items } = await supabase
                .from("SellableItems")
                .select("id, type, product_id")
                .in("id", itemIds);

            const itemTypeMap = new Map(items?.map(i => [i.id, i.type]) || []);
            const itemProductMap = new Map(items?.map(i => [i.id, i.product_id]) || []);

            // Проверяем, какие товары ещё существуют в базе
            const productIds = Array.from(itemProductMap.values()).filter(Boolean);
            let existingProductIds = new Set<string>();

            if (productIds.length > 0) {
                const { data: existingProducts } = await supabase
                    .from("Products")
                    .select("id")
                    .in("id", productIds);

                existingProductIds = new Set(existingProducts?.map(p => p.id) || []);
            }

            const movements = [];
            for (const line of sale.SaleLines) {
                 const itemType = itemTypeMap.get(line.sellable_item_id);
                 const productId = itemProductMap.get(line.sellable_item_id);

                 // Добавляем движение только если это продукт И он ещё существует
                 if (itemType === 'product' && productId && existingProductIds.has(productId)) {
                     movements.push({
                        warehouse_id: warehouseId,
                        product_id: productId,
                        move_type: 'adjustment',
                        quantity: line.quantity, // Adding back
                        reference_id: sale.id,
                        reference_table: 'Sales',
                        created_at: new Date().toISOString()
                     });
                 }
            }

            if (movements.length > 0) {
                const { error: moveError } = await supabase
                    .from("StockMovements")
                    .insert(movements);
                if (moveError) throw moveError;
            }
        }
        
        // Explicitly delete lines first to avoid foreign key violations if CASCADE is missing
        const { error: linesError } = await supabase
            .from("SaleLines")
            .delete()
            .eq("sale_id", id);
            
        if (linesError) throw linesError;
    }

    const { error } = await supabase
        .from("Sales")
        .delete()
        .eq("id", id);
    if (error) throw error;
};

export const updateSale = async (id: string, data: { patient_id?: string | null; comment?: string; lines?: any[]; cash?: number; card?: number; totalAmount?: number }) => {
    // Определяем статус на основе оплаты (если данные переданы)
    let status: string | undefined;

    if (data.cash !== undefined && data.card !== undefined && data.totalAmount !== undefined) {
        const totalPaid = (data.cash || 0) + (data.card || 0);
        const total = data.totalAmount;

        if (totalPaid >= total) {
            status = 'paid'; // Полностью оплачено
        } else if (totalPaid > 0) {
            status = 'partial'; // Частично оплачено
        } else {
            status = 'open'; // Не оплачено
        }
    }

    // 1. Update Header
    const updateData: any = {
        patient_id: data.patient_id,
        comment: data.comment
    };

    // Обновляем статус только если он был вычислен
    if (status !== undefined) {
        updateData.status = status;
    }

    const { error: headerError } = await supabase
        .from("Sales")
        .update(updateData)
        .eq("id", id);

    if (headerError) throw headerError;

    // 2. Handle Lines if provided
    if (data.lines) {
        // Fetch current lines
        const { data: fileSales } = await supabase
            .from("Sales")
            .select("*, SaleLines(*)")
            .eq("id", id)
            .single();
        
        const currentLines = fileSales?.SaleLines || [];
        const newLines = data.lines;

        // Fetch Warehouse
        const { data: warehouse } = await supabase
            .from("Warehouses")
            .select("id")
            .eq("is_primary", true)
            .single();
        const warehouseId = warehouse?.id;

        if (!warehouseId) throw new Error("No primary warehouse found");

        // Identification
        // Current lines have 'id'. New lines might have 'id' (if update) or not (if new).
        // Actually, UI usually passes sellable_item_id. 
        // Let's match primarily by sellable_item_id to see what changed, OR use line ID if available.
        // Simple approach: Match by sellable_item_id.

        // Fetch types for all involved items (new and old)
        const allItemIds = new Set<string>();
        currentLines.forEach((l: any) => allItemIds.add(l.sellable_item_id));
        newLines.forEach((l: any) => allItemIds.add(l.sellable_item_id));

        const { data: items } = await supabase
            .from("SellableItems")
            .select("id, type")
            .in("id", Array.from(allItemIds));
        
        const itemTypeMap = new Map(items?.map(i => [i.id, i.type]) || []);

        // A) Process New/Updated
        for (const newLine of newLines) {
            const existingLine = currentLines.find((cl: any) => cl.sellable_item_id === newLine.sellable_item_id);
            const isProduct = itemTypeMap.get(newLine.sellable_item_id) === 'product';

            if (existingLine) {
                // Check if quantity changed
                if (existingLine.quantity !== newLine.quantity && isProduct) {
                    const diff = newLine.quantity - existingLine.quantity; // e.g. 5 - 2 = +3 (added)
                    
                    await createStockMovement({
                        warehouse_id: warehouseId,
                        product_id: newLine.sellable_item_id,
                        move_type: 'adjustment', // Or correction
                        quantity: -diff, 
                        reference_id: id,
                        reference_table: 'Sales'
                    });
                }

                // ALWAYS Update Line (price might have changed)
                await supabase
                    .from("SaleLines")
                    .update({ 
                        quantity: newLine.quantity,
                        price_at_sale: newLine.price,
                        total: newLine.quantity * newLine.price
                    })
                    .eq("id", existingLine.id);

            } else {
                // New Line
                if (isProduct) {
                    await createStockMovement({
                        warehouse_id: warehouseId,
                        product_id: newLine.sellable_item_id,
                        move_type: 'consumption',
                        quantity: -newLine.quantity,
                        reference_id: id,
                        reference_table: 'Sales'
                    });
                }

                await supabase
                    .from("SaleLines")
                    .insert([{
                        sale_id: id,
                        sellable_item_id: newLine.sellable_item_id,
                        quantity: newLine.quantity,
                        price_at_sale: newLine.price
                    }]);
            }
        }

        // B) Process Removed
        for (const oldLine of currentLines) {
            const stillExists = newLines.find((nl: any) => nl.sellable_item_id === oldLine.sellable_item_id);
            if (!stillExists) {
                // Removed
                const isProduct = itemTypeMap.get(oldLine.sellable_item_id) === 'product';
                if (isProduct) {
                     // Return stock
                    await createStockMovement({
                        warehouse_id: warehouseId,
                        product_id: oldLine.sellable_item_id,
                        move_type: 'adjustment',
                        quantity: oldLine.quantity, // Add back
                        reference_id: id,
                        reference_table: 'Sales'
                    });
                }

                await supabase
                    .from("SaleLines")
                    .delete()
                    .eq("id", oldLine.id);
            }
        }
    }
};
