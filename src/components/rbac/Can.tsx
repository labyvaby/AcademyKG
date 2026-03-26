import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import type { Permission } from '../../constants/permissions';

// Парсим все валидные пары resource.action из типа Permission (все строки вида "resource.action")
type SplitDot<S extends string> = S extends `${infer R}.${infer A}` ? { resource: R; action: A } : never;
type AllPairs = SplitDot<Permission>;
type AllResources = AllPairs['resource'];
type AllActions = AllPairs['action'];

interface CanProps {
  resource: AllResources;
  action: AllActions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Условный рендеринг на основе permissions.
 * Если нет доступа — элемент полностью отсутствует в DOM (return null).
 * resource и action типизированы — опечатки ловятся на этапе компиляции.
 *
 * @example
 * <Can resource="patients" action="create">
 *   <Button>Добавить</Button>
 * </Can>
 *
 * @example
 * <Can resource="employees" action="delete" fallback={<ReadOnlyNote />}>
 *   <DeleteButton />
 * </Can>
 */
export const Can: React.FC<CanProps> = ({ resource, action, children, fallback = null }) => {
  const { can } = usePermissions();
  return <>{can(resource, action) ? children : fallback}</>;
};

export default Can;
