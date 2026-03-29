import React from "react";

export type CreateSaleData = Record<string, unknown>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const CreateSaleDrawer: React.FC<Props> = () => null;
