import { ThemeProvider } from "@mui/material/styles";
import { getAppTheme } from "../../theme";
import React, {
  PropsWithChildren,
  createContext,
  useEffect,
  useState,
} from "react";

type ColorModeContextType = {
  mode: string;
  setMode: () => void;
};

export const ColorModeContext = createContext<ColorModeContextType>(
  {} as ColorModeContextType
);

export const ColorModeContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  // const colorModeFromLocalStorage = localStorage.getItem("colorMode");
  // const isSystemPreferenceDark = window?.matchMedia(
  //   "(prefers-color-scheme: dark)"
  // ).matches;

  // const systemPreference = isSystemPreferenceDark ? "dark" : "light";
  
  // Всегда светлая тема по умолчанию
  const [mode] = useState("light");

  useEffect(() => {
    window.localStorage.setItem("colorMode", mode);
  }, [mode]);

  const setColorMode = () => {
    // Темная тема отключена пользователем
    // if (mode === "light") {
    //   setMode("dark");
    // } else {
    //   setMode("light");
    // }
  };

  return (
    <ColorModeContext.Provider
      value={{
        setMode: setColorMode,
        mode,
      }}
    >
      <ThemeProvider theme={getAppTheme(mode)}>
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
