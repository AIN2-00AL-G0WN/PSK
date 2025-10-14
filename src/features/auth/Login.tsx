import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../../components/card";
import { Input } from "../../components/input";
import { Button } from "../../components/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!username.trim() || !password) {
            setError("Please enter username and password.");
            return;
        }

        setLoading(true);

        try {
            // Step 1: Login to get token
            const formData = new URLSearchParams();
            formData.append("username", username);
            formData.append("password", password);

            const response = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                },
                body: formData.toString(),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.detail || "Invalid credentials");
            }

            const data = await response.json();
            const token = data.access_token;

            // Step 2: Fetch user info
            const userRes = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            });

            if (!userRes.ok) {
                throw new Error("Failed to fetch user details");
            }

            const userData = await userRes.json();

            // Step 3: Save token + user info
            const user = {
                id: userData.id,
                username: userData.contact_email,
                team_name: userData.team_name,
                is_admin: userData.is_admin,
                token: token,
            };

            localStorage.setItem("user", JSON.stringify(user));

            if (remember) {
                localStorage.setItem("token", token);
            } else {
                sessionStorage.setItem("token", token);
            }

            // Step 4: Redirect based on role
            if (userData.is_admin) {
                navigate("/admin");
            } else {
                navigate("/user");
            }
        } catch (err: any) {
            console.error("Login failed:", err);
            if (err?.message?.includes("Failed to fetch")) {
                setError("Cannot connect to server. Check backend URL and network.");
            } else {
                setError(err?.message || "Login failed");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="container py-12 font-inter text-slate-800">
            <div className="max-w-md mx-auto">
                {/* Title */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent py-1">
                        Get your Ek-Code
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Manage Ek-Codes across regions in simple steps
                    </p>
                </div>

                <Card className="border border-slate-200 rounded-2xl hover:shadow-md transition">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl font-extrabold text-center text-slate-900 leading-tight tracking-tight">
                            Login
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        <form className="space-y-5" onSubmit={handleLogin}>
                            {/* Username */}
                            <div className="space-y-1.5">
                                <label htmlFor="username" className="text-sm font-medium text-slate-700">
                                    Username
                                </label>
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username or email"
                                    className="rounded-lg border-slate-300 focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                                    Password
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className="rounded-lg border-slate-300 focus:ring-2 focus:ring-indigo-400"
                                />
                            </div>

                            {/* Remember me */}
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 select-none">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={() => setRemember(!remember)}
                                    className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-2"
                                />
                                <span>Remember me</span>
                            </label>

                            {/* Error */}
                            {error && (
                                <p className="text-rose-600 text-sm" role="alert">
                                    {error}
                                </p>
                            )}

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500 text-white font-semibold px-6 py-3 rounded-full shadow-sm hover:shadow-md disabled:opacity-60"
                            >
                                {loading ? "Signing in…" : "Sign in"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-slate-500 mt-4">
                    Tip: If you’re on a shared device, keep “Remember me” unchecked.
                </p>
            </div>
        </main>
    );
}