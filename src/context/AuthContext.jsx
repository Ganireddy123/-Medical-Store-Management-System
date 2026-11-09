import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { api } from "../API/context";
import { setUser } from "../store";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const [user, setAuthUser] = useState(null);
  const [initializing, setInitializing] = useState(() => Boolean(localStorage.getItem("medistore_token")));
  useEffect(() => {
    if (!localStorage.getItem("medistore_token")) return;
    api.me().then(({ user: savedUser }) => {
      setAuthUser(savedUser); dispatch(setUser(savedUser));
    }).catch(() => localStorage.removeItem("medistore_token")).finally(() => setInitializing(false));
  }, [dispatch]);
  const value = useMemo(() => ({
    user, initializing, isAuthenticated: Boolean(user),
    async login(email, password) {
      const result = await api.login(email, password);
      localStorage.setItem("medistore_token", result.token);
      const nextUser = result.user || { name: email.split("@")[0], email };
      setAuthUser(nextUser); dispatch(setUser(nextUser));
    },
    demoLogin() {
      const nextUser = { name: "Store Admin", email: "admin@medistore.in" };
      localStorage.setItem("medistore_token", "demo-token");
      setAuthUser(nextUser); dispatch(setUser(nextUser));
    },
    logout() {
      localStorage.removeItem("medistore_token"); setAuthUser(null); dispatch(setUser(null));
    },
  }), [user, initializing, dispatch]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
