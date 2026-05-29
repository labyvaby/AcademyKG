import { apiFetch, getBranchFilter } from "../utility/apiClient";

export type Product = {
  sellable_item_id: string; // Map from 'id' in API
  name: string;
  description?: string;
  category?: string;
  barcode?: string;
  unit?: string;
  is_for_sale?: boolean; // Map from 'isForSale'
  is_infusion?: boolean; // Map from 'isInfusion'
  image_url?: string;    // Map from 'imageUrl'
  comment?: string;
  created_at: string;
  updated_at: string;
  price?: number;
  stock?: number;
};

export type CreateProductData = {
  name: string;
  description?: string;
  category?: string;
  barcode?: string;
  unit?: string;
  is_for_sale?: boolean;
  is_infusion?: boolean;
  image_url?: string | File;
  comment?: string;
  price?: number;
  stock?: number;
};

export type UpdateProductData = Partial<CreateProductData>;

const mapApiToProduct = (apiP: any, pricesMap?: Map<string, number>): Product => {
    const id = apiP.id;
    return {
        sellable_item_id: id,
        name: apiP.name,
        description: apiP.description,
        category: apiP.category,
        barcode: apiP.barcode,
        unit: apiP.unit,
        is_for_sale: apiP.isForSale,
        is_infusion: apiP.isInfusion,
        image_url: apiP.imageUrl,
        comment: apiP.comment,
        created_at: apiP.createdAt,
        updated_at: apiP.updatedAt,
        price: pricesMap?.get(id) || apiP.price,
        stock: apiP.stock || 0
    };
};

export const getProducts = async (): Promise<Product[]> => {
    try {
        // Try catalog/sellable-items?type=product first (new API)
        const res: any = await apiFetch("/catalog/sellable-items/?type=product&is_active=true&pageSize=1000");
        const items = res?.data?.results ?? res?.results ?? res ?? [];

        if (Array.isArray(items) && items.length > 0) {
            return items.map((item: any) => ({
                sellable_item_id: item.id,
                name: item.display_name ?? item.name ?? "Без названия",
                price: item.display_price ?? item.price,
                image_url: item.product?.image_url ?? item.image_url,
                is_for_sale: item.product?.is_for_sale ?? true,
                is_infusion: item.product?.is_infusion ?? false,
                created_at: item.created_at ?? "",
                updated_at: item.updated_at ?? "",
                stock: item.stock ?? 0,
            } as Product));
        }
    } catch {
        // fallback to old endpoint below
    }

    // Fallback: old endpoints
    const res: any = await apiFetch("/api/v1/products/?pageSize=1000");
    const products = res?.data?.results ?? res?.results ?? res ?? [];

    if (!Array.isArray(products)) return [];

    const pricesRes: any = await apiFetch("/api/v1/prices/?pageSize=1000&is_current=true");
    const prices = pricesRes?.data?.results ?? pricesRes?.results ?? pricesRes ?? [];
    const pricesMap = new Map<string, number>();
    if (Array.isArray(prices)) {
        prices.forEach((p: any) => { pricesMap.set(p.sellableItem, Number(p.price)); });
    }

    return products.map((p: any) => mapApiToProduct(p, pricesMap));
};

export const createProduct = async (productData: CreateProductData) => {
    const branchId = getBranchFilter();
    if (!branchId) {
        throw Object.assign(new Error("Выберите филиал перед созданием товара"), { code: "NO_BRANCH" });
    }

    const formData = new FormData();
    formData.append("branch", branchId);

    const mapping: Record<string, string> = {
        name: 'name',
        description: 'description',
        category: 'category',
        barcode: 'barcode',
        unit: 'unit',
        is_for_sale: 'isForSale',
        is_infusion: 'isInfusion',
        image_url: 'imageUrl',
        comment: 'comment',
        stock: 'stock'
    };

    Object.entries(productData).forEach(([key, value]) => {
        const apiKey = mapping[key];
        if (apiKey && value !== undefined && value !== null) {
            if (value instanceof File) {
                formData.append(apiKey, value);
            } else {
                formData.append(apiKey, String(value));
            }
        }
    });

    const res: any = await apiFetch("/api/v1/products/", {
        method: "POST",
        body: formData,
    });
    
    const product = res?.data ?? res;
    const sellableId = product.id;

    // 3. Create Price
    if (productData.price !== undefined) {
        await apiFetch("/api/v1/prices/", {
            method: "POST",
            body: JSON.stringify({
                sellableItem: sellableId,
                price: productData.price,
                isCurrent: true
            })
        });
    }

    return mapApiToProduct(product);
};

export const updateProduct = async (id: string, productData: UpdateProductData) => {
    const formData = new FormData();
    
    const mapping: Record<string, string> = {
        name: 'name',
        description: 'description',
        category: 'category',
        barcode: 'barcode',
        unit: 'unit',
        is_for_sale: 'isForSale',
        is_infusion: 'isInfusion',
        image_url: 'imageUrl',
        comment: 'comment',
        stock: 'stock'
    };

    Object.entries(productData).forEach(([key, value]) => {
        const apiKey = mapping[key];
        if (apiKey && value !== undefined && value !== null) {
            if (value instanceof File) {
                formData.append(apiKey, value);
            } else {
                formData.append(apiKey, String(value));
            }
        }
    });

    const res: any = await apiFetch(`/api/v1/products/${id}/`, {
        method: "PATCH",
        body: formData,
    });

    const product = res?.data ?? res;

    // Update Price
    if (productData.price !== undefined) {
        await apiFetch("/api/v1/prices/", {
            method: "POST",
            body: JSON.stringify({
                sellableItem: id,
                price: productData.price,
                isCurrent: true
            })
        });
    }

    return mapApiToProduct(product);
};

export const deleteProduct = async (id: string) => {
    await apiFetch(`/api/v1/products/${id}/`, {
        method: "DELETE"
    });
};
