import React from "react";
import type { Sale } from "../../services/sales";

interface Props {
  open: boolean;
  onClose: () => void;
  sale?: Sale | null;
  onUpdated?: () => void;
}

export const EditSaleDrawer: React.FC<Props> = () => null;
