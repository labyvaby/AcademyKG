import React from "react";
import { MenuItem, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useReportBranchScope } from "../../hooks/useReportBranchScope";

export type ReportBranchSelectProps = {
    sx?: SxProps<Theme>;
};

// Переключатель филиала для страниц отчётов. Виден только не-суперадмину
// с несколькими allowedBranches — суперадмин пользуется глобальным
// переключателем в сайдбаре, сотрудник с одним филиалом выбора не имеет.
export const ReportBranchSelect: React.FC<ReportBranchSelectProps> = ({ sx }) => {
    const { showSwitcher, options, branch, setBranch } = useReportBranchScope();

    if (!showSwitcher) return null;

    return (
        <TextField
            select
            size="small"
            label="Филиал"
            value={branch?.id ?? ""}
            onChange={(e) => setBranch(e.target.value)}
            sx={{ minWidth: 200, ...sx }}
        >
            {options.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                    {b.brandName || b.name}
                </MenuItem>
            ))}
        </TextField>
    );
};

export default ReportBranchSelect;
