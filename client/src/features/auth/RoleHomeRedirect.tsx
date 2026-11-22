import { Navigate } from "react-router-dom";
import { homePathFor } from "./roleHome";
import { useAuth } from "./useAuth";

/** `/` sends every role to its own landing page. Rendered inside RequireAuth. */
export const RoleHomeRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathFor(user)} replace />;
};
