/**
 * PatientHistoryPanel.tsx
 * Компонент отображает среднюю колонку с истории приемов выбранного клиента.
 * Состояния:
 *  - Если клиент не выбран — показывает подсказку
 *  - Загрузка / ошибка
 *  - Список приемов с навигацией к карточке приема
 * Презентационный компонент: не содержит API-логики, принимает данные через пропсы.
 */
import React from "react";
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
  List,
  ListItemButton,
} from "@mui/material";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import dayjs from "dayjs";
import { formatKGS } from "../../../utility/format";
import type { Theme } from "@mui/material/styles";
import { getStatusChipStyles, normalizeStatus } from "../../../config/appointmentStatuses";
import type { HistoryRow } from "../../../types/models";

type Props = {
  selected: boolean;
  loading: boolean;
  errorMsg: string | null;
  history: HistoryRow[];
  onClick: (row: HistoryRow) => void;
};

const PatientHistoryPanel: React.FC<Props> = ({
  selected,
  loading,
  errorMsg,
  history,
  onClick,
}) => {
  return (
    <Box sx={{ height: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
              <Stack direction="row" alignItems="center" gap={1.25}>
                <HistoryOutlined color="primary" />
                <Typography variant="h6">История приемов</Typography>
              </Stack>
              <Chip size="small" label={history.length} />
            </Stack>
          }
          sx={{ pb: 1 }}
        />
        <Divider />
        <CardContent sx={{ p: 0, flex: 1, overflowY: "auto", minHeight: 0 }}>
          {!selected ? (
            <Typography sx={{ p: 2 }} variant="body2" color="text.secondary" align="center">
              Выберите клиента слева
            </Typography>
          ) : loading ? (
            <Typography sx={{ p: 2 }} variant="body2" color="text.secondary" align="center">
              Загрузка…
            </Typography>
          ) : errorMsg ? (
            <Typography sx={{ p: 2 }} variant="body2" color="error" align="center">
              Ошибка: {errorMsg}
            </Typography>
          ) : history.length === 0 ? (
            <Typography sx={{ p: 2 }} variant="body2" color="text.secondary" align="center">
              История пуста
            </Typography>
          ) : (
            <List disablePadding sx={{ px: 1, py: 0.5 }}>
              {history.map((h) => (
                <ListItemButton
                  key={h.ID}
                  onClick={() => onClick(h)}
                  sx={{
                    px: 2,
                    py: 1.25,
                    my: "5px",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    alignItems: "flex-start",
                    "&:hover": {
                      bgcolor: (theme) => theme.palette.action.hover,
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    gap={2}
                    sx={{ width: "100%" }}
                  >
                    <Stack>
                      <Typography variant="subtitle2">
                        {h["Дата и время"]
                          ? dayjs(h["Дата и время"]).format("DD.MM.YYYY HH:mm")
                          : "—"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Тренер: {h["Доктор ФИО"] || "—"}
                      </Typography>
                      {h["Услуга"] && (
                        <Typography variant="body2" color="text.secondary">
                          Услуга: {h["Услуга"]}
                        </Typography>
                      )}
                    </Stack>
                    <Stack alignItems="flex-end">
                      {typeof h["Итого, сом"] !== "undefined" ||
                        typeof h["Стоимость"] !== "undefined" ? (
                        <Typography variant="body2" color="text.secondary" fontWeight="medium">
                          {formatKGS(h["Итого, сом"] ?? h["Стоимость"] ?? 0)}
                        </Typography>
                      ) : null}
                      {h.Статус && (
                        <Chip
                          label={normalizeStatus(h.Статус)}
                          size="small"
                          sx={(theme: Theme) => ({
                            mt: 0.5,
                            ...getStatusChipStyles(h.Статус ?? "", theme),
                          })}
                        />
                      )}
                    </Stack>
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PatientHistoryPanel;

