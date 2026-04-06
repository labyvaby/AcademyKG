import React from "react";
import { Navigate, useLocation } from "react-router";
import { isAuthenticated } from "../../services/auth";

type Props = {
  children: React.ReactNode;
};

export const RequireAuth: React.FC<Props> = ({ children }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    const to = location.pathname + location.search;
    return <Navigate to={`/login?to=${encodeURIComponent(to)}`} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
