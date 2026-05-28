import React from "react";
import MuiAutocomplete from "@mui/material/Autocomplete";
import type { AutocompleteProps } from "@mui/material/Autocomplete";
import { Chip, Box } from "@mui/material";

/**
 * Тонкий wrapper над MUI Autocomplete.
 * Стрелка справа открывает список БЕЗ фокуса input (мобильная клавиатура не всплывает).
 * Тап по самому полю — стандартное поведение (поиск/клавиатура).
 *
 * Fixes:
 * - multiple: chips ограничены по высоте (scrollable, max 120px) — поле не растягивается
 * - blur: inputValue не очищается при потере фокуса без выбора варианта
 * - listbox: max-height учитывает visual viewport (mobile keyboard)
 */
function AppAutocomplete<
  Value,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>(props: AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo>) {
  const { open: openProp, onOpen, onClose, onInputChange, slotProps, multiple, ...rest } = props;

  const isControlled = openProp !== undefined;
  const [openState, setOpenState] = React.useState(false);
  const open = isControlled ? openProp : openState;

  // Баг 5: не очищать inputValue при blur без выбора
  const [inputVal, setInputVal] = React.useState("");

  // При внешнем выборе value (например reset после submit) — синхронизируем inputVal
  const valueProp = (rest as any).value;
  React.useEffect(() => {
    if (!onInputChange) return;
    if (valueProp == null || valueProp === "") {
      setInputVal("");
    }
  }, [valueProp, onInputChange]);

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

  // Баг 5: при reason === "reset" (blur без выбора) — не очищаем inputValue
  const handleInputChange: typeof onInputChange = (e, value, reason) => {
    if (reason === "reset" && !value) {
      // MUI очищает поле при blur — оставляем текущий текст
      return;
    }
    setInputVal(value);
    onInputChange?.(e, value, reason);
  };

  // Баг 5: при выборе варианта — очищаем локальный inputVal
  const handleChange: typeof rest.onChange = (e, value, reason, details) => {
    if (reason === "selectOption" || reason === "clear") {
      setInputVal("");
    }
    rest.onChange?.(e, value, reason, details);
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
    // Баг 6: большой max-height с touch-friendly scroll; поле само скроллится внутри drawer
    listbox: {
      style: {
        maxHeight: 320,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch" as any,
        overscrollBehavior: "contain",
      },
      ...(slotProps as any)?.listbox,
    },
  };

  // Баг 4: для multiple — chips в scrollable контейнере, поле не растягивается
  const renderTagsMultiple = multiple
    ? (tagValue: Value[], getTagProps: any) => (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
            maxHeight: 120,
            overflowY: "auto",
            width: "100%",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            py: 0.5,
          }}
        >
          {tagValue.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return <Chip key={key} size="small" {...tagProps} />;
          })}
        </Box>
      )
    : undefined;

  // renderTags из props имеет приоритет над нашим дефолтным
  const renderTagsProp = (rest as any).renderTags ?? renderTagsMultiple;

  // Баг 5: не очищать поисковую строку при blur без выбора варианта.
  // clearOnBlur=false по умолчанию для single-select; multiple не трогаем.
  const clearOnBlurDefault = multiple ? undefined : false;
  const clearOnBlur = (rest as any).clearOnBlur ?? clearOnBlurDefault;

  return (
    <MuiAutocomplete
      {...rest}
      multiple={multiple}
      open={open}
      onOpen={handleOpen}
      onClose={handleClose}
      clearOnBlur={clearOnBlur}
      inputValue={onInputChange ? inputVal : undefined}
      onInputChange={onInputChange ? handleInputChange : undefined}
      onChange={handleChange}
      renderTags={renderTagsProp}
      slotProps={mergedSlotProps}
    />
  );
}

export default AppAutocomplete;
