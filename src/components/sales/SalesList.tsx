
import React from 'react';
import {
    Box,
    Typography,
    Paper,
    List,
    ListItemButton,
    Avatar,
    Tooltip,
    Chip,
    Stack
} from '@mui/material';
import { Sale } from '../../services/sales';
import { ReceiptOutlined } from '@mui/icons-material';
import { formatKGS } from '../../utility/format';
import { getSaleStatusConfig, getSaleStatusChipSx } from '../../config/saleStatuses';

interface SalesListProps {
    sales: Sale[];
    selectedSale: Sale | null;
    onSelect: (sale: Sale) => void;
    loading: boolean;
}

export const SalesList: React.FC<SalesListProps> = ({ sales, selectedSale, onSelect, loading }) => {

    if (loading && sales.length === 0) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    Загрузка...
                </Typography>
            </Box>
        );
    }

    if (sales.length === 0) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    Нет продаж
                </Typography>
            </Box>
        );
    }

    return (
        <Paper
            elevation={0}
            variant="outlined"
            sx={{
                height: { xs: 'auto', md: '100%' },
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Список продаж ({sales.length})
                </Typography>
            </Box>
            <Box
                sx={{
                    overflowY: 'auto',
                    flex: 1,
                    pb: 2,
                }}
            >
                <List sx={{ py: 0.5 }}>
                    {sales.map((sale) => (
                        <ListItemButton
                            key={sale.id}
                            sx={{
                                px: 2,
                                py: 1.5,
                                bgcolor: selectedSale?.id === sale.id ? 'action.selected' : 'transparent',
                                '&:hover': { bgcolor: 'action.hover' },
                                borderBottom: 1,
                                borderColor: 'divider',
                            }}
                            onClick={() => onSelect(sale)}
                        >
                            <Avatar
                                variant="rounded"
                                src={sale.lines?.[0]?.product_image || undefined}
                                sx={{ mr: 2, width: 40, height: 40, bgcolor: 'action.selected', color: 'text.secondary' }}
                            >
                                <ReceiptOutlined />
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body1" sx={{ fontWeight: 500 }} noWrap>
                                    {sale.lines?.map(l => l.product_name).filter(Boolean).join(', ') || 'Товар удален'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    {sale.patient_name || 'Анонимный'}
                                </Typography>
                            </Box>
                            <Stack alignItems="flex-end" spacing={0.5}>
                                <Chip
                                    label={getSaleStatusConfig(sale.status).label}
                                    icon={getSaleStatusConfig(sale.status).icon}
                                    size="small"
                                    sx={getSaleStatusChipSx(sale.status)}
                                />
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {formatKGS(sale.total_amount ?? 0)}
                                </Typography>
                            </Stack>
                        </ListItemButton>
                    ))}
                </List>
            </Box>
        </Paper>
    );
};
