// Stub — sales functionality is pending backend implementation

export type SaleLine = {
  id: string;
  sale_id: string;
  sellable_item_id: string;
  quantity: number;
  price_at_sale: number;
  total: number;
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
  lines?: SaleLine[];
  patient_name?: string;
  patient_phone?: string;
  patient_avatar?: string;
  total_amount?: number;
};

export type CreateSaleData = Record<string, unknown>;

export async function getSales(): Promise<Sale[]> { return []; }
export async function createSale(_data: CreateSaleData): Promise<Sale> { throw new Error("Not implemented"); }
export async function updateSale(_id: string, _data: Partial<Sale>): Promise<Sale> { throw new Error("Not implemented"); }
export async function deleteSale(_id: string): Promise<void> { throw new Error("Not implemented"); }
