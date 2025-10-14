import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../../components/card";
import { Input } from "../../components/input";
import { Button } from "../../components/button";
import { Textarea } from "../../components/textarea";
import { Label } from "../../components/label";
import { RadioGroup, RadioGroupItem } from "../../components/radio-group";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/table";
import { Separator } from "../../components/separator";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "../../components/accordion";
import { Eye, EyeOff, LogOut, BarChart3, Boxes, PlusCircle, Trash2, Users as UsersIcon, Pencil, ShieldCheck, Search } from "lucide-react";
import { useToast } from "../../components/use-toast";
import { useNavigate } from "react-router-dom";

function formatDisplayDate(isoDate: string) {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split("-");
    return `${day}-${month}-${year}`;
}
/* ---------- Types ---------- */
interface CodePools {
    [family: string]: {
        reserved: string[];
        can_be_used: string[];
    };
}
interface User {
    id: number;
    team_name: string;
    user_name: string;
    contact_email: string;
    is_admin: boolean;
    reservedCount: number;
}

/* ---------- Small UI bits ---------- */
const ActionBadge = ({ action }: { action: string }) => {
    const A = (action || "").toUpperCase();
    const styles: Record<string, string> = {
        RESERVED: "bg-amber-100 text-amber-800 border-amber-200",
        RELEASED: "bg-emerald-100 text-emerald-700 border-emerald-200",
        ADDED: "bg-sky-100 text-sky-700 border-sky-200",
        DELETED: "bg-rose-100 text-rose-700 border-rose-200",
    };
    const cls = styles[A] || "bg-slate-100 text-slate-700 border-slate-200";
    return (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${cls}`}>
      {A || "-"}
    </span>
    );
};

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [authorized, setAuthorized] = useState<boolean | null>(null);

    // counts
    const [totalCodes, setTotalCodes] = useState(0);
    const [usedCodes, setUsedCodes] = useState(0);
    const [unusedCodes, setUnusedCodes] = useState(0);

    // pools
    const [codePools, setCodePools] = useState<CodePools>({});

    // users
    const [users, setUsers] = useState<any[]>([]);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [teamName, setTeamName] = useState("");
    const [userName, setUserName] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [userPassword, setUserPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [userToDelete, setUserToDelete] = useState<number | null>(null);

    // code add/delete
    const [selectedFamily, setSelectedFamily] = useState<"HSV" | "OSV" | "Common">("HSV");
    const [countries, setCountries] = useState<{ id: number; country: string }[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [codesText, setCodesText] = useState("");
    const [deleteCodesText, setDeleteCodesText] = useState("");

    // logs
    const [logs, setLogs] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const totalPages = Math.ceil(totalCount / 20);

    // shared
    const [searchQuery, setSearchQuery] = useState("");

    const [filters, setFilters] = useState({
        code: "",
        user_name: "",
        action: "",
        start_date: "",
        end_date: "",
    });

    const API_BASE = import.meta.env.VITE_API_BASE;

    /* ---------- Authorization ---------- */
    useEffect(() => {
        const localUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        const user = localUser ? JSON.parse(localUser) : null;

        if (!user || !user.is_admin) {
            toast({
                title: "Access Denied",
                description: "Only admins can access this page.",
                variant: "destructive",
            });
            navigate("/");
        } else {
            setAuthorized(true);
        }
    }, [navigate, toast]);

    /* ---------- API helpers ---------- */
    function getAuthHeader(): Record<string, string> {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        const user = storedUser ? JSON.parse(storedUser) : null;
        const token = user?.token;
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    async function apiRequest(path: string, options: RequestInit = {}) {
        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...getAuthHeader(),
                ...(options.headers as Record<string, string>),
            };

            const res = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers,
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || res.statusText);
            }

            return await res.json();
        } catch (err) {
            console.error("API Request Error:", err);
            throw err;
        }
    }

    /* ---------- Fetchers ---------- */
    const fetchCounts = async () => {
        try {
            const data = await apiRequest("/admin/count", { method: "GET" });
            setTotalCodes(data.total || 0);
            setUsedCodes(data.reserved || 0);
            setUnusedCodes(data.can_be_used || 0);
        } catch (err) {
            console.error("Error fetching counts:", err);
        }
    };

    const fetchPools = async () => {
        try {
            const data: CodePools = await apiRequest("/admin/codes/all");
            setCodePools(data);
        } catch (err) {
            console.error("Error fetching pools:", err);
        }
    };

    const fetchUsers = async () => {
        try {
            const data = await apiRequest("/admin/users/get-users", { method: "GET" });
            const nonAdmins = data.filter((u: any) => !u.is_admin);
            setUsers(nonAdmins);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    const fetchCountries = async () => {
        const data = await apiRequest("/admin/countries");
        setCountries(data);
    };

    const fetchLogs = async (pageNum = 1, appliedFilters = filters) => {
        try {
            setLoading(true);
            const query = new URLSearchParams({
                page: pageNum.toString(),
                page_size: "20",
                ...(appliedFilters.code && { code: appliedFilters.code }),
                ...(appliedFilters.user_name && { user_name: appliedFilters.user_name }),
                ...(appliedFilters.action && { action: appliedFilters.action }),
                ...(appliedFilters.start_date && { start_date: appliedFilters.start_date }),
                ...(appliedFilters.end_date && { end_date: appliedFilters.end_date }),
            }).toString();

            const res = await apiRequest(`/admin/logs?${query}`);
            setLogs(res.logs || []);
            setTotalCount(res.total_count || 0);
        } catch (err) {
            console.error("Error fetching logs:", err);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authorized) {
            fetchCounts();
            fetchPools();
            fetchUsers();
            fetchCountries();
            fetchLogs(1, filters);
        }
    }, [authorized]);

    useEffect(() => {
        fetchLogs(page, filters);
    }, [page, filters]);

    /* ---------- Pools helpers ---------- */
    function getCodesByStatus(family: string, status: "unused" | "used") {
        const pool = codePools[family];
        if (!pool) return [];
        const list = status === "unused" ? pool.can_be_used : pool.reserved;
        return list.map((c, idx) => ({ id: `${family}_${idx}`, code: c }));
    }

    function highlight(code: string) {
        if (!searchQuery) return code;
        const regex = new RegExp(`(${searchQuery})`, "gi");
        return code.replace(regex, "<mark>$1</mark>");
    }

    /* ---------- User create/update ---------- */
    const handleCreateOrUpdateUser = async () => {
        if (!teamName || !userName || !userEmail || !userPassword) {
            toast({
                title: "Validation Error",
                description: "Please fill all fields before creating a user.",
                variant: "destructive",
            });
            return;
        }

        try {
            const params = new URLSearchParams({
                team_name: teamName,
                user_name: userName,
                contact_email: userEmail,
                password: userPassword,
                is_admin: "false",
            });

            if (editingUser) {
                await apiRequest(
                    `/admin/users/update?id=${editingUser.id}&${params.toString()}`,
                    { method: "PATCH" }
                );
                toast({ title: "User Updated", description: "Details saved successfully." });
            } else {
                await apiRequest(`/admin/users/create?${params.toString()}`, {
                    method: "POST",
                });
                toast({ title: "User Created", description: "New user added." });
            }

            // ⚡ Quick hack: reload + auto scroll to user section
            window.location.href = `${window.location.pathname}#team-user-section`;
            window.location.reload();

        } catch (err) {
            console.error("Error creating/updating user:", err);
            toast({
                title: "Action Failed",
                description: err.message || "Please try again.",
                variant: "destructive",
            });
        }
    };

    /* ---------- Delete user ---------- */
    async function handleDelete(userId: number) {
        try {
            const data = await apiRequest(`/admin/users/delete?id=${userId}`, {
                method: "DELETE",
            });

            toast({
                title: "Deleted",
                description: data.message || "User deleted successfully",
            });

            setUsers((prev) => prev.filter((u) => u.id !== userId));
        } catch (err: any) {
            let msg = "Action failed";
            if (err.message) {
                try {
                    const parsed = JSON.parse(err.message);
                    msg = parsed.message || msg;
                } catch {
                    msg = err.message;
                }
            }
            toast({
                title: "Action Failed",
                description: msg,
                variant: "destructive",
            });
        }
    }

    /* ---------- Add/Delete codes ---------- */
    const handleAddCodes = async () => {
        const token = JSON.parse(localStorage.getItem("user") || "{}").token;
        if (!codesText.trim()) return;

        const codes = codesText
            .split(/[\s,]+/)
            .map((c) => c.trim())
            .filter(Boolean);

        if (!codes.length) return;

        if (selectedFamily !== "Common" && !selectedCountry) {
            toast({
                title: "Validation Error",
                description: "Please select a country for HSV/OSV family.",
                variant: "destructive",
            });
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE}/admin/codes/add?code_type=${selectedFamily.toUpperCase()}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        codes,
                        countries: selectedFamily === "Common" ? [] : [selectedCountry],
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to add codes");
            }

            const result = await response.json();

            if (result.inserted?.length) {
                toast({
                    title: "Codes Added",
                    description: `Successfully added: ${result.inserted.join(", ")}`,
                });
            }

            if (result.failed?.length) {
                const failedCodes = result.failed.map((f: any) => `${f[0]} (${f[1]})`);
                toast({
                    title: "Failed Codes",
                    description: `Failed: ${failedCodes.join(", ")}`,
                    variant: "destructive",
                });
            }

            setCodesText("");
            fetchPools();
            fetchCounts();
        } catch (err: any) {
            console.error("Error adding codes:", err);
            toast({
                title: "Action Failed",
                description: err.message || "Error adding codes",
                variant: "destructive",
            });
        }
    };

    const handleDeleteCodes = async () => {
        const codes = deleteCodesText
            .split(/[\n, ,]+/)
            .map((c) => c.trim())
            .filter(Boolean);

        if (!codes.length) {
            toast({
                title: "Validation Error",
                description: "Please enter at least one code to delete.",
                variant: "destructive",
            });
            return;
        }

        const results: string[] = [];

        for (const code of codes) {
            try {
                const res = await apiRequest(`/admin/codes/${code}`, {
                    method: "DELETE",
                });

                results.push(`${res.message || `Deleted ${code}`}`);
            } catch (err: any) {
                try {
                    const parsed = JSON.parse(err.message);
                    if (parsed?.error === "not_found") {
                        results.push(`${code}: ${parsed.message}`);
                    } else {
                        results.push(`${code}: ${parsed.message || "Unknown error"}`);
                    }
                } catch {
                    results.push(`${code}: ${err.message || "Unexpected error"}`);
                }
            }
        }

        toast({ title: "Delete Results", description: results.join("\n") });

        setDeleteCodesText("");
        fetchPools();
        fetchCounts();
    };

    /* ---------- Filtering helpers ---------- */
    const filteredUsers = users.filter(
        (u) =>
            u.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.team_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (authorized === null) {
        return <div className="text-center py-10 text-lg font-semibold">Loading...</div>;
    }

    /* ---------- Render ---------- */
    return (
        <main className="container py-10 space-y-8 font-inter text-slate-800">
            {/* Top bar */}
            <div className="w-full flex justify-end items-start mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        localStorage.removeItem("user");
                        sessionStorage.removeItem("user");
                        navigate("/");
                    }}
                    className="group inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 border-slate-300 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Logout"
                    title="Logout"
                >
                    <span>Logout</span>
                    <LogOut className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
            </div>

            {/* Title */}
            <div className="text-center mb-2">
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                    Admin Dashboard
                </h1>
                <p className="mt-2 text-slate-500 text-sm">Manage users, EK-codes, and activity</p>
            </div>

            {/* Code Summary */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-xl font-semibold">Code Summary</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                    <Card className="hover:shadow-md transition">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                Total EK-codes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-3xl font-bold">{totalCodes}</CardContent>
                    </Card>
                    <Card className="hover:shadow-md transition">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <Boxes className="h-4 w-4 text-rose-600" />
                                Used (Reserved)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-3xl font-bold text-rose-600">{usedCodes}</CardContent>
                    </Card>
                    <Card className="hover:shadow-md transition">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <Boxes className="h-4 w-4 text-emerald-600" />
                                Available
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-3xl font-bold text-emerald-600">{unusedCodes}</CardContent>
                    </Card>
                </div>
            </section>

            {/* Code Pools */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <Boxes className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-xl font-semibold">Code Pools</h2>
                </div>
                <Card className="hover:shadow-md transition">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-slate-600" />
                            EK-code Pools by Family
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <Input
                                placeholder="Search codes…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        <Accordion type="multiple" className="w-full">
                            {Object.keys(codePools).length > 0 ? (
                                Object.keys(codePools).map((family) => {
                                    const availableCodes = getCodesByStatus(family, "unused");
                                    const usedCodes = getCodesByStatus(family, "used");

                                    return (
                                        <AccordionItem key={family} value={family.toLowerCase()}>
                                            <AccordionTrigger>{family} Codes</AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-2">
                                                    <div className="text-sm font-medium">
                                                        Available Codes: {availableCodes.length}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {availableCodes.length ? (
                                                            availableCodes
                                                                .filter((c) =>
                                                                    c.code.toLowerCase().includes(searchQuery.toLowerCase())
                                                                )
                                                                .map((c) => (
                                                                    <span
                                                                        key={c.code}
                                                                        className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-xs"
                                                                        dangerouslySetInnerHTML={{ __html: highlight(c.code) }}
                                                                    />
                                                                ))
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">No available codes</span>
                                                        )}
                                                    </div>

                                                    <div className="text-sm font-medium mt-2">Used Codes: {usedCodes.length}</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {usedCodes.length ? (
                                                            usedCodes
                                                                .filter((c) =>
                                                                    c.code.toLowerCase().includes(searchQuery.toLowerCase())
                                                                )
                                                                .map((c) => (
                                                                    <span
                                                                        key={c.code}
                                                                        className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono text-xs"
                                                                        dangerouslySetInnerHTML={{ __html: highlight(c.code) }}
                                                                    />
                                                                ))
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">No used codes</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    );
                                })
                            ) : (
                                <div className="text-center text-muted-foreground">No codes found</div>
                            )}
                        </Accordion>
                    </CardContent>
                </Card>
            </section>

            {/* Code Management */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <PlusCircle className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-xl font-semibold">Code Management</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Add Codes */}
                    <Card className="hover:shadow-md transition">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PlusCircle className="h-4 w-4 text-sky-600" />
                                Add EK-code
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select the family</Label>
                                <RadioGroup
                                    value={selectedFamily}
                                    onValueChange={(v) => {
                                        const family = v as any;
                                        setSelectedFamily(family);
                                        if (family === "Common") setSelectedCountry("");
                                    }}
                                    className="flex gap-6"
                                >
                                    {["HSV", "OSV", "Common"].map((f) => (
                                        <div key={f} className="flex items-center space-x-2">
                                            <RadioGroupItem id={`ct-${f.toLowerCase()}`} value={f} />
                                            <Label htmlFor={`ct-${f.toLowerCase()}`}>{f}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>

                            <div className="space-y-2">
                                <Label>Select the country</Label>
                                <select
                                    className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring focus:ring-indigo-200"
                                    value={selectedCountry}
                                    onChange={(e) => setSelectedCountry(e.target.value)}
                                    disabled={selectedFamily === "Common"}
                                >
                                    <option value="">-- Select a country --</option>
                                    {countries.map((c) => (
                                        <option key={c.id} value={c.country}>
                                            {c.country}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="codes">Enter one code per line, comma, or space</Label>
                                <Textarea
                                    id="codes"
                                    value={codesText}
                                    onChange={(e) => setCodesText(e.target.value)}
                                    placeholder="Enter codes to add"
                                    className="min-h-[120px]"
                                />
                            </div>

                            <Button size="sm" onClick={handleAddCodes} className="sm:w-auto w-full">
                                Add Code
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Delete Codes */}
                    <Card className="hover:shadow-md transition">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trash2 className="h-4 w-4 text-rose-600" />
                                Delete EK-code
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="del-codes">
                                    Enter codes to delete (one per line, comma, or space)
                                </Label>
                                <Textarea
                                    id="del-codes"
                                    value={deleteCodesText}
                                    onChange={(e) => setDeleteCodesText(e.target.value)}
                                    placeholder="Enter codes to delete"
                                    className="min-h-[120px]"
                                />
                            </div>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="sm:w-auto w-full"
                                onClick={handleDeleteCodes}
                            >
                                Delete
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Team & User Management */}
            <section id="team-user-section">
                <div className="flex items-center gap-2 mb-3">
                    <UsersIcon className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-xl font-semibold">Team & User Management</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Create/Edit */}
                    <Card className="hover:shadow-md transition">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Pencil className="h-4 w-4 text-slate-700" />
                                Create / Edit Team Account
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="t-name">Team name</Label>
                                <Input
                                    id="t-name"
                                    placeholder="Enter team name"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="u-team">User name</Label>
                                <Input
                                    id="u-team"
                                    placeholder="Enter user name"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="u-mail">User email</Label>
                                <Input
                                    id="u-mail"
                                    type="email"
                                    placeholder="Enter user email"
                                    value={userEmail}
                                    onChange={(e) => setUserEmail(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2 relative">
                                <Label htmlFor="u-pass">Password</Label>
                                <Input
                                    id="u-pass"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={userPassword}
                                    onChange={(e) => setUserPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            <Button className="w-full" onClick={handleCreateOrUpdateUser}>
                                {editingUser ? "Save Changes" : "Create User"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Team list */}
                    <Card className="h-full flex flex-col hover:shadow-md transition">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UsersIcon className="h-4 w-4 text-indigo-600" />
                                Team Details
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="flex flex-col flex-1">
                            <div className="mb-3">
                                <Input
                                    placeholder="Search by email or team"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="max-h-[280px] overflow-y-auto border rounded-md">
                                <Table className="min-w-full">
                                    <TableHeader className="sticky top-0 bg-white z-10 border-b">
                                        <TableRow className="align-middle">
                                            <TableHead>Team Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Codes Assigned</TableHead>
                                            <TableHead className="text-center">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filteredUsers.length ? (
                                            filteredUsers.map((u, index) => (
                                                <TableRow
                                                    key={`${u.id || u.contact_email}_${index}`}
                                                    className={index % 2 ? "bg-slate-50" : "bg-white"}
                                                >
                                                    <TableCell className="font-medium">{u.team_name}</TableCell>
                                                    <TableCell>{u.contact_email}</TableCell>
                                                    <TableCell>{u.reserved_count || 0}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setEditingUser(u);
                                                                    setTeamName(u.team_name);
                                                                    setUserName(u.user_name);
                                                                    setUserEmail(u.contact_email);
                                                                    setUserPassword("");
                                                                }}
                                                                className="inline-flex items-center gap-1"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                                Edit
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => setUserToDelete(u.id)}
                                                                className="inline-flex items-center gap-1"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="text-center text-muted-foreground"
                                                >
                                                    No users found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="mt-2 text-center font-medium">Total teams: {users.length}</div>
                        </CardContent>

                        {userToDelete !== null && (
                            <div className="fixed inset-0 flex items-center justify-center z-50">
                                <div className="absolute inset-0 backdrop-blur-sm bg-black/20"></div>
                                <div className="relative bg-white rounded-lg p-6 shadow-lg w-80 z-10">
                                    <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
                                    <p className="mb-4">Are you sure you want to delete this user?</p>
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setUserToDelete(null)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={async () => {
                                                if (userToDelete === null) return;
                                                await handleDelete(userToDelete);
                                                setUserToDelete(null);
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </section>

            <Separator />

            {/* Logs & Activity */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-xl font-semibold">Logs & Activity</h2>
                </div>

                <Card className="hover:shadow-md transition">
                    <CardHeader>
                        <CardTitle>Activity History</CardTitle>
                    </CardHeader>

                    {/* 👇 Fixed outer height */}
                    <CardContent className="min-h-[600px] flex flex-col">
                        {/* 🔒 AUTO-CLAMP PAGE (pure inline, no new hooks) */}
                        {page > (totalPages || 1) && (
                            <span className="hidden">
          {setTimeout(() => setPage(Math.max(1, totalPages || 1)), 0)}
        </span>
                        )}

                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 mb-4 text-sm">
                            <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 font-semibold">RESERVED</span>
                            <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold">RELEASED</span>
                            <span className="px-2 py-1 rounded bg-sky-100 text-sky-700 font-semibold">ADDED</span>
                            <span className="px-2 py-1 rounded bg-rose-100 text-rose-800 font-semibold">DELETED</span>
                        </div>

                        {/* 👇 Fixed scrollable table height ~15 rows */}
                        <div className="relative h-[480px] overflow-auto rounded-lg border bg-white">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-100 z-10">
                                <tr className="text-left border-b text-[0.95rem] font-semibold text-slate-700">
                                    <th className="py-2 px-2 min-w-[240px]">
                                        Date
                                        <div className="flex gap-1 mt-1">
                                            <Input
                                                type="date"
                                                value={filters.start_date}
                                                onChange={(e) =>
                                                    setFilters({ ...filters, start_date: e.target.value })
                                                }
                                                className="h-8"
                                            />
                                            <Input
                                                type="date"
                                                value={filters.end_date}
                                                onChange={(e) =>
                                                    setFilters({ ...filters, end_date: e.target.value })
                                                }
                                                className="h-8"
                                            />
                                        </div>
                                        {/* 🧊 Human-friendly preview in DD-MM-YYYY */}
                                        <div className="mt-1 text-xs text-slate-500">
                                            {filters.start_date
                                                ? `From: ${formatDisplayDate(filters.start_date)}`
                                                : "From: —"}
                                            {"  "}
                                            {filters.end_date
                                                ? ` | To: ${formatDisplayDate(filters.end_date)}`
                                                : " | To: —"}
                                        </div>
                                    </th>

                                    <th className="py-2 px-2 min-w-[180px]">
                                        User
                                        <Input
                                            placeholder="Filter user"
                                            value={filters.user_name}
                                            onChange={(e) =>
                                                setFilters({ ...filters, user_name: e.target.value })
                                            }
                                            className="h-8 mt-1"
                                        />
                                    </th>

                                    <th className="py-2 px-2 align-top min-w-[140px]">
                                        <div className="flex flex-col">
                                            <span className="mb-1">Action</span>
                                            <select
                                                className="border rounded h-8 px-1 text-sm"
                                                value={filters.action}
                                                onChange={(e) =>
                                                    setFilters({ ...filters, action: e.target.value })
                                                }
                                            >
                                                <option value="">All</option>
                                                <option value="RESERVED">RESERVED</option>
                                                <option value="RELEASED">RELEASED</option>
                                                <option value="ADDED">ADDED</option>
                                                <option value="DELETED">DELETED</option>
                                            </select>
                                        </div>
                                    </th>

                                    <th className="py-2 px-2 min-w-[180px]">
                                        EK-code
                                        <Input
                                            placeholder="Filter code"
                                            value={filters.code}
                                            onChange={(e) =>
                                                setFilters({ ...filters, code: e.target.value.trim() })
                                            }
                                            className="h-8 mt-1"
                                        />
                                    </th>

                                    <th className="py-2 px-2 min-w-[220px]">Comments</th>
                                </tr>
                                </thead>

                                <tbody>
                                {logs.map((log, i) => (
                                    <tr
                                        key={log.id}
                                        className={`border-b ${i % 2 ? "bg-slate-50" : "bg-white"} hover:bg-indigo-50/40 transition`}
                                    >
                                        <td className="py-2 px-2 whitespace-nowrap">{log.logged_at_str}</td>
                                        <td className="py-2 px-2">{log.user_name}</td>
                                        <td className="py-2 px-2">
                                            <ActionBadge action={log.action} />
                                        </td>
                                        <td className="py-2 px-2 font-mono">{log.code}</td>
                                        <td className="py-2 px-2">{log.note || "-"}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>

                            {/* Overlay states */}
                            {!loading && logs.length === 0 && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                                    <div>No records found</div>
                                    {page > (totalPages || 1) && (
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => setPage(1)}>
                                                Go to First Page
                                            </Button>
                                            <Button size="sm" onClick={() => setPage(Math.max(1, totalPages || 1))}>
                                                Go to Last Page
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                    Loading...
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
                            <Button variant="outline" onClick={() => setPage(1)} disabled={page === 1}>
                                First
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>

                            <span className="px-3 py-1 rounded bg-slate-100 text-slate-700">
          Page {Math.min(page, Math.max(1, totalPages || 1))} of {Math.max(1, totalPages || 1)}
        </span>

                            <Button
                                variant="outline"
                                onClick={() => setPage((p) => Math.min(p + 1, Math.max(1, totalPages || 1)))}
                                disabled={page >= (totalPages || 1)}
                            >
                                Next
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setPage(Math.max(1, totalPages || 1))}
                                disabled={page >= (totalPages || 1)}
                            >
                                Last
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>

            <Separator />
        </main>
    );
}