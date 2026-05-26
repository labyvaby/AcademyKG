import React from "react";
import MuiAutocomplete from "@mui/material/Autocomplete";
import type { AutocompleteProps } from "@mui/material/Autocomplete";

/**
 * Тонкий wrapper над MUI Autocomplete.
 * Стрелка справа открывает список БЕЗ фокуса input (мобильная клавиатура не всплывает).
 * Тап по самому полю — стандартное поведение (поиск/клавиатура).
 */
function AppAutocomplete<
  Value,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>(props: AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>) {
  const { open: openProp, onOpen, onClose, slotProps, ...rest } = props;

  const isControlled = openProp !== undefined;
  const [openState, setOpenState] = React.useState(false);
  const open = isControlled ? openProp : openState;

  const handleOpen: typeof onOpen = (e) => {
    if (!isControlled) setOpenState(true);
    onOpen?.(e);
  };
  const handleClose: typeof onClose = (e, reason) => {
    if (!isControlled) setOpenState(false);
    onClose?.(e, reason);
  };

  const handleArrowInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    // Предотвращаем фокус на input → мобильная клавиатура не открывается
    e.preventDefault();
    e.stopPropagation();
    if (!isControlled) {
      setOpenState((prev) => !prev);
    } else {
      if (open) {
        onClose?.(e as any, "toggleInput");
      } else {
        onOpen?.(e as any);
      }
    }
  };

  const mergedSlotProps: typeof slotProps = {
    ...slotProps,
    popupIndicator: {
      ...(slotProps as any)?.popupIndicator,
      onMouseDown: handleArrowInteraction,
      onTouchStart: handleArrowInteraction,
    },
    popper: {
      disablePortal: true,
      placement: "bottom-start" as const,
      modifiers: [
        { name: "flip", enabled: false },
        { name: "preventOverflow", enabled: false },
      ],
      ...(slotProps as any)?.popper,
    },
    listbox: {
      style: { maxHeight: 240 },
      ...(slotProps as any)?.listbox,
    },
  };

  return (
    <MuiAutocomplete
      {...rest}
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      slotProps={mergedSlotProps}
    />
  );
}

export default AppAutocomplete;
