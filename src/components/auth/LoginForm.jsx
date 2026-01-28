import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/auth.js";

/**
 * Login form with access-level specific buttons.
 *
 * The selected level is used for navigation hints, but the server
 * determines the real access level based on the user account.
 */
export default function LoginForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      console.log("[LoginForm] Attempting login with username:", username);
      const result = await login(username, password);
      console.log("[LoginForm] Login successful. Result:", result);
      console.log("[LoginForm] Access level returned:", result.accessLevel);

      // Redirect based on the actual access level returned by the server.
      const destination =
        result.accessLevel === "admin" ? "/admin" : "/tree";
      console.log("[LoginForm] Redirecting to:", destination);
      navigate(destination);
    } catch (err) {
      console.error("[LoginForm] Login failed:", err.message);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page">
      <h1>E. Tawiah Family Tree</h1>
      <p className="subtitle">Sign in to continue.</p>
      <p>
        Enter your credentials. The server determines your access level and
        stores the JWT in localStorage for future requests.
      </p>

      <div className="form-grid">
        <label className="form-field">
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="your name"
            autoComplete="username"
          />
        </label>

        <label className="form-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="button-row">
        <button type="button" onClick={handleLogin} disabled={isSubmitting}>
          Sign In
        </button>
      </div>
    </section>
  );
}
