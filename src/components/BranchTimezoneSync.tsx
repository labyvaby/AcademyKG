import React from "react";
import { useBranchTimezone } from "../hooks/useBranchTimezone";
import { setActiveTimezone } from "../utility/branchTime";

/**
 * Синхронизирует активную таймзону (utility/branchTime) с таймзоной
 * эффективного филиала. Монтируется один раз внутри BranchProvider,
 * ДО остального дерева — чтобы форматирование дат в этом же коммите
 * рендера уже использовало правильную таймзону.
 */
export const BranchTimezoneSync: React.FC = () => {
  const tz = useBranchTimezone();

  // Обновляем и в рендер-фазе (модульная переменная, идемпотентно):
  // компоненты ниже по дереву рендерятся после нас и сразу видят новую
  // таймзону, не дожидаясь эффектов.
  setActiveTimezone(tz);

  React.useEffect(() => {
    setActiveTimezone(tz);
  }, [tz]);

  return null;
};
