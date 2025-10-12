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
        <main className="container py-12">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 bg-clip-text text-transparent">
                        Get your Ek-Code
                    </h1>

                    <p className="mt-2 text-muted-foreground">
                        Manage Ek-Codes across regions in simple steps
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl font-extrabold text-center text-gray-900 mb-6 leading-tight tracking-tight">
                            Login
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={handleLogin}>
                            <div className="space-y-2">
                                <label htmlFor="username" className="text-sm font-medium">
                                    Username
                                </label>
                                <br />
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username or email"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium">
                                    Password
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                />
                            </div>

                            {/* REMEMBER ME CHECK BOX  */}

                            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-blue-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={() => setRemember(!remember)}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-2"
                                />
                                <span>Remember Me</span>
                            </label>

                            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white font-semibold px-6 py-3 rounded-full shadow-lg transform transition duration-300 hover:scale-105 hover:shadow-xl"
                            >
                                Sign in
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
