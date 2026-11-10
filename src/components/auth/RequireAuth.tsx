import React from "react";
import { Navigate, useLocation } from "react-router";
import { isAuthenticated } from "../../services/auth";
import { useMustChangePassword } from "../../hooks/usePermissions";
import ForcePasswordChange from "./ForcePasswordChange";

type Props = {
  children: React.ReactNode;
};

export const RequireAuth: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const mustChangePassword = useMustChangePassword();

  if (!isAuthenticated()) {
    const to = location.pathname + location.search;
    return <Navigate to={`/login?to=${encodeURIComponent(to)}`} replace />;
  }

  // Вошёл стандартным паролем — пока не сменит, никаких страниц.
  if (mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return <>{children}</>;
};

export default RequireAuth;
