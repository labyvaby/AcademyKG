import { useEffect } from "react";
import { useTitleContext } from "../contexts/title-context";

export const usePageTitle = (title: string) => {
  const { setTitle } = useTitleContext();

  useEffect(() => {
    setTitle(title);
    document.title = `${title} | Academy KG`;

    return () => {
      setTitle("Academy KG");
      document.title = "Academy KG";
    };
  }, [title, setTitle]);
};
