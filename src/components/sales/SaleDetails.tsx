
import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../constants/permissions';

import {
    Box,
    Typography,
    Paper,
    Stack,
    Divider,
    Avatar,
    Button,
    IconButton,
    Tooltip,
    alpha,
    Chip
} from '@mui/material';
import { Sale } from '../../services/sales';
import { ReceiptOutlined, EditOutlined, DeleteOutline } from '@mui/icons-material';
import { formatKGS, formatDateRu } from '../../utility/format';

import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PaymentInfoBlock } from '../ui';
import { getSaleStatusConfig, getSaleStatusChipSx } from '../../config/saleStatuses';

type ParsedPaymentInfo = {
    hasPaymentInfo: boolean;
    userComment: string | null;
    cash: number | null;
    card: number | null;
    discountPercent: number | null;
    discountAmount: number | null;
    debt: number | null;
};

const parsePaymentComment = (comment?: string | null): ParsedPaymentInfo => {
    if (!comment) {
        return {
            hasPaymentInfo: false,
            userComment: null,
            cash: null,
            card: null,
            discountPercent: null,
            discountAmount: null,
            debt: null,
        };
    }

    const lines = comment.split('\n');
    const paymentIndex = lines.findIndex((line) => line.trim().startsWith('Оплата:'));

    if (paymentIndex === -1) {
        const trimmed = comment.trim();
        return {
            hasPaymentInfo: false,
            userComment: trimmed.length > 0 ? trimmed : null,
            cash: null,
            card: null,
            discountPercent: null,
            discountAmount: null,
            debt: null,
        };
    }

    const userCommentText = lines.slice(0, paymentIndex).join('\n').trim();
    const paymentLine = lines[paymentIndex];

    const parseNumber = (match: RegExpMatchArray | null): number | null => {
        if (!match || match[1] == null) {
            return null;
        }
        const value = Number(match[1]);
        return Number.isNaN(value) ? null : value;
    };

    const cashMatch = paymentLine.match(/Наличные\s+(\d+)/);
    const cardMatch = paymentLine.match(/Карта\s+(\d+)/);
    const discountPercentMatch = paymentLine.match(/Скидка\s+(\d+)%/);
    const discountAmountMatch = paymentLine.match(/Скидка\s+\d+%\s*\((\d+)\)/);
    const debtMatch = paymentLine.match(/Долг:\s*(\d+)/);

    const cash = parseNumber(cashMatch);
    const card = parseNumber(cardMatch);
    const discountPercent = parseNumber(discountPercentMatch);
    const discountAmount = parseNumber(discountAmountMatch);
    const debt = parseNumber(debtMatch);

    const hasPaymentInfo =
        cash !== null ||
        card !== null ||
        discountPercent !== null ||
        discountAmount !== null ||
        debt !== null;

    return {
        hasPaymentInfo,
        userComment: userCommentText.length > 0 ? userCommentText : null,
        cash,
        card,
        discountPercent,
        discountAmount,
        debt,
    };
};

interface SaleDetailsProps {
    sale: Sale | null;
    onEdit?: (sale: Sale) => void;
    onDelete?: (sale: Sale) => void;
}

export const SaleDetails: React.FC<SaleDetailsProps> = ({ sale, onEdit, onDelete }) => {
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const { hasPermission } = usePermissions();
    const canEdit = hasPermission(PERMISSIONS.SALES_UPDATE);
    const canDelete = hasPermission(PERMISSIONS.SALES_DELETE);


    if (!sale) {
        return (
            <Box
                sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    color: 'text.secondary',
                }}
            >
                <Typography>Выберите продажу для просмотра</Typography>
            </Box>
        );
    }

    const paymentInfo = parsePaymentComment(sale.comment);

    const totalColor: string = (() => {
        if (sale.status === 'paid') {
            return 'success.main';
        }
        if (sale.status === 'partial') {
            return 'warning.main';
        }
        if (sale.status === 'open') {
            return 'error.main';
        }
        return 'text.primary';
    })();

    return (
        <>
            <Paper
                elevation={0}
                variant="outlined"
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Кнопки управления */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1}>
                            {canEdit && onEdit && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<EditOutlined />}
                                    onClick={() => onEdit?.(sale)}
                                >
                                    Изменить
                                </Button>
                            )}
                        </Stack>

                        {canDelete && (
                            <Tooltip title="Удалить">
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={() => setConfirmOpen(true)}
                                        sx={{
                                            border: '1px solid',
                                            borderColor: 'error.main',
                                            color: 'error.main',
                                            '&:hover': {
                                                borderColor: 'error.dark',
                                                backgroundColor: (theme) => alpha(theme.palette.error.main, 0.08),
                                            }
                                        }}
                                    >
                                        <DeleteOutline fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                    </Stack>
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        p: 3,
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        '&::-webkit-scrollbar': {
                            display: 'none',
                        },
                    }}
                >
                    <Stack spacing={3}>
                        {/* Заголовок продажи */}
                        <Box>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Продажа #{sale.id.slice(0, 8)}
                                </Typography>
                                <Chip
                                    label={getSaleStatusConfig(sale.status).label}
                                    icon={getSaleStatusConfig(sale.status).icon}
                                    size="small"
                                    sx={getSaleStatusChipSx(sale.status)}
                                />
                            </Stack>
                        </Box>

                        {/* Дата и время */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                                Дата и время
                            </Typography>
                            <Typography variant="body1">
                                {sale.created_at
                                    ? `${formatDateRu(sale.created_at)}, ${new Date(sale.created_at).toLocaleTimeString('ru-RU', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}`
                                    : '—'}
                            </Typography>
                        </Box>

                        <Divider />

                        {/* Информация о пациенте */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                                Покупатель
                            </Typography>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
                                }}
                            >
                                <Avatar
                                    src={sale.patient_avatar || undefined}
                                    sx={{
                                        width: 56,
                                        height: 56,
                                        mr: 2,
                                        bgcolor: 'primary.light',
                                        color: 'primary.contrastText',
                                    }}
                                >
                                    {sale.patient_name?.charAt(0) || 'А'}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        {sale.patient_name || 'Анонимный покупатель'}
                                    </Typography>
                                    {sale.patient_phone && (
                                        <Typography variant="body2" color="text.secondary">
                                            {sale.patient_phone}
                                        </Typography>
                                    )}
                                    {sale.patient_id && (
                                        <Typography variant="caption" color="text.disabled" display="block">
                                            ID: {sale.patient_id.slice(0, 8)}
                                        </Typography>
                                    )}
                                </Box>
                            </Paper>
                        </Box>

                        <Divider />

                        {/* Товары */}
                        <Box>
                            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                                Товары
                            </Typography>
                            <Stack spacing={1.5}>
                                {sale.lines?.map((line) => (
                                    <Paper
                                        key={line.id}
                                        variant="outlined"
                                        sx={{
                                            p: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                        }}
                                    >
                                        <Avatar
                                            variant="rounded"
                                            src={line.product_image || undefined}
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                bgcolor: 'action.selected',
                                                color: 'text.secondary',
                                            }}
                                        >
                                            <ReceiptOutlined />
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body1" fontWeight={600}>
                                                {line.product_name || 'Товар удален'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {line.quantity} шт × {formatKGS(line.price_at_sale)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body1" fontWeight={700}>
                                            {formatKGS(line.total)}
                                        </Typography>
                                    </Paper>
                                ))}
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Payment Information */}
                        <PaymentInfoBlock
                            payment={{
                                baseTotal: sale.total_amount ?? 0,
                                discountPercent: paymentInfo.discountPercent ?? undefined,
                                discountAmount: paymentInfo.discountAmount ?? undefined,
                                cash: paymentInfo.cash ?? 0,
                                card: paymentInfo.card ?? 0,
                                finalTotal: sale.total_amount ?? 0,
                                // Вычисляем долг: если есть в комментарии - берем оттуда, иначе вычисляем
                                debt: paymentInfo.debt ?? (sale.total_amount ?? 0) - ((paymentInfo.cash ?? 0) + (paymentInfo.card ?? 0)),
                                status: sale.status, // Передаем реальный статус из БД
                            }}
                            variant="detailed"
                            showIcons={true}
                        />

                        {/* Комментарий */}
                        {paymentInfo.userComment && (
                            <>
                                <Divider />
                                <Box>
                                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                                        Комментарий
                                    </Typography>
                                    <Typography variant="body2">{paymentInfo.userComment}</Typography>
                                </Box>
                            </>
                        )}
                    </Stack>
                </Box>
            </Paper>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => {
                    onDelete?.(sale);
                    setConfirmOpen(false);
                }}
                title="Удаление продажи"
                message="Вы уверены, что хотите удалить эту продажу? Это действие нельзя отменить, а товары вернутся на склад."
                confirmText="Удалить"
                variant="error"
            />
        </>
    );
};
