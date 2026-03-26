import React from 'react';
import { Button, type ButtonProps } from '@mui/material';
import { usePermissions } from '../../hooks/usePermissions';
import type { Permission } from '../../constants/permissions';

// Парсим все валидные пары resource.action из типа Permission
type SplitDot<S extends string> = S extends `${infer R}.${infer A}` ? { resource: R; action: A } : never;
type AllPairs = SplitDot<Permission>;
type AllResources = AllPairs['resource'];
type AllActions = AllPairs['action'];

interface CanButtonProps extends Omit<ButtonProps, 'action'> {
  resource: AllResources;
  action: AllActions;
}


/**
 * Кнопка с проверкой permission.
 * Если нет доступа — кнопка полностью отсутствует в DOM (return null).
 * Никакого disabled, никакого CSS-скрытия.
 *
 * @example
 * <CanButton resource="employees" action="create" variant="contained" onClick={handleAdd}>
 *   Добавить сотрудника
 * </CanButton>
 */
export const CanButton: React.FC<CanButtonProps> = ({ resource, action, ...buttonProps }) => {
  const { can } = usePermissions();
  if (!can(resource, action)) return null;
  return <Button {...buttonProps} />;
};

export default CanButton;
