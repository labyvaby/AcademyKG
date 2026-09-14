/**
 * ServiceEmployeeSelector.tsx
 * Презентационный блок выбора сотрудника(ов) для услуги.
 * Отвечает только за UI: Autocomplete (multiple) с чекбоксами и кнопку "Добавить сотрудника".
 * Не содержит бизнес-логики — получает данные и колбэки через пропсы.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Stack,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Checkbox,
} from "@mui/material";
import AppAutocomplete from "../../components/ui/AppAutocomplete";
import { createFilterOptions } from "@mui/material/Autocomplete";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import type { EmployeesRow } from "../../pages/expenses/types";

export type ServiceEmployeeSelectorProps = {
  employees: EmployeesRow[];
  loadingEmps: boolean;
  selectedEmps: EmployeesRow[];
  onSelectChange: (list: EmployeesRow[]) => void;
  onAddEmployeeClick?: () => void;
};

const ServiceEmployeeSelector: React.FC<ServiceEmployeeSelectorProps> = ({
  employees,
  loadingEmps,
  selectedEmps,
  onSelectChange,
  onAddEmployeeClick,
}) => {
  const { t } = useTranslation();
  const optionLabel = React.useCallback(
    (o: EmployeesRow) =>
      `${o.full_name || o.id} — ${o.specialization || t("services.noSpecialization")}`,
    [t]
  );
  const filterEmployees = createFilterOptions<EmployeesRow>({
    matchFrom: "start",
    stringify: (o) => `${o.full_name ?? ""} ${o.specialization ?? ""}`.trim(),
  });

  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        {t("services.selectEmployeeColon")}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1}>
        <AppAutocomplete
          multiple
          loading={loadingEmps}
          options={employees}
          value={selectedEmps}
          filterSelectedOptions
          disableCloseOnSelect
          getOptionLabel={(o) => optionLabel(o)}
          filterOptions={filterEmployees}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          onChange={(_, v) => onSelectChange(v ?? [])}
          renderOption={(props, option, { selected }) => {
            const { key, ...optionProps } = props;
            return (
              <li key={key} {...optionProps}>
                <Checkbox size="small" style={{ marginRight: 8 }} checked={selected} />
                {optionLabel(option)}
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField {...params} placeholder={t("services.employeesPlaceholder")} fullWidth size="small" />
          )}
          sx={{ flex: 1 }}
        />
        <Tooltip title={t("services.addEmployeeNavigate")}>
          <span>
            <IconButton
              color="inherit"
              onClick={onAddEmployeeClick}
              aria-label={t("employees.addEmployee")}
            >
              <PersonAddAltOutlined />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  );
};

export default ServiceEmployeeSelector;
