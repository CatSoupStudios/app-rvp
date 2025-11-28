import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useHistory } from "react-router-dom";
import "./Login.css";

// Icono de usuario tipo "monito"
const UserIcon = () => (
  <span className="input-icon">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="9" r="4" stroke="#61aee8" strokeWidth="2"/>
      <path d="M4 19c0-2.5 3-4.5 8-4.5s8 2 8 4.5" stroke="#61aee8" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </span>
);

const LockIcon = () => (
  <span className="input-icon">
    <svg width={18} height={18} fill="none" viewBox="0 0 24 24">
      <rect x="6" y="11" width="12" height="7" rx="2" stroke="#61aee8" strokeWidth="2" />
      <path d="M9 11V8a3 3 0 1 1 6 0v3" stroke="#61aee8" strokeWidth="2" />
    </svg>
  </span>
);

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!loading && (e.key === "Enter" || e.key === " ")) {
      handleLogin(e as any);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault?.();
    if (loading) return;
    setMsg(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        setMsg("User data not found.");
        setLoading(false);
        return;
      }
      const data = userDoc.data();
      const role = data.role;

      // 👇 CAMBIO AQUÍ: usa `history.replace` para que dashboard "reemplace" la entrada de login en historial
      if (role === "boss") {
        history.replace("/dashboard-boss");
      } else if (role === "worker") {
        history.replace("/dashboard-worker");
      } else {
        setMsg("Unknown role. Cannot redirect.");
      }
    } catch (err: any) {
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-credential" ||
        err.code === "auth/invalid-email"
      ) {
        setMsg("Email or password incorrect.");
      } else {
        setMsg("Login failed. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="login-outer">
      <div className="login-stack">
        <div className="login-title">Welcome</div>
        <div className="login-desc">Sign in to continue</div>
        <form className="login-form" autoComplete="off" onSubmit={handleLogin} style={{width:"100%"}}>
          <div className="input-group">
            <UserIcon />
            <input
              className="login-input"
              type="email"
              placeholder="Email"
              value={email}
              autoComplete="email"
              onChange={e => { setEmail(e.target.value); setMsg(null); }}
              required
              spellCheck={false}
              maxLength={60}
              inputMode="email"
            />
          </div>
          <div className="input-group">
            <LockIcon />
            <input
              className="login-input"
              type="password"
              placeholder="Password"
              value={password}
              autoComplete="current-password"
              onChange={e => { setPassword(e.target.value); setMsg(null); }}
              required
              spellCheck={false}
              maxLength={40}
              inputMode="text"
            />
          </div>
          <div
            className="login-btn"
            role="button"
            tabIndex={0}
            aria-disabled={loading}
            onClick={!loading ? handleLogin : undefined}
            onKeyDown={handleKeyDown}
            style={{pointerEvents: loading ? "none" : undefined}}
          >
            {loading ? "Signing In..." : "Sign In"}
          </div>
          <div className="login-msg">{msg || "\u00A0"}</div>
        </form>
        <div className="login-footer">Powered by @Ori</div>
      </div>
    </div>
  );
};

export default Login;