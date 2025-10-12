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
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "../../components/use-toast";
import { useNavigate } from "react-router-dom";

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

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { toast } = useToast(); // <-- use-toast hook

    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [totalCodes, setTotalCodes] = useState(0);
    const [usedCodes, setUsedCodes] = useState(0);
    const [unusedCodes, setUnusedCodes] = useState(0);
    const [users, setUsers] = useState<any[]>([]);
    const [codePools, setCodePools] = useState<CodePools>({});
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [teamName, setTeamName] = useState("");
    const [userName, setUserName] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [userPassword, setUserPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [countries, setCountries] = useState<{ id: number; country: string }[]>([]);
    const [selectedFamily, setSelectedFamily] = useState<"HSV" | "OSV" | "Common">("HSV");
    const [codesText, setCodesText] = useState("");
    const [deleteCodesText, setDeleteCodesText] = useState("");
    const [logs, setLogs] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [userToDelete, setUserToDelete] = useState<number | null>(null);
    const [filters, setFilters] = useState({
        code: "",
        user_name: "",
        action: "",
        start_date: "",
        end_date: "",
    });
    const totalPages = Math.ceil(totalCount / 20);

    const API_BASE = import.meta.env.VITE_API_BASE;

    // ----------------- Authorization -----------------
    useEffect(() => {
        const localUser =
            localStorage.getItem("user") || sessionStorage.getItem("user");
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

    //---------------------API Auth --------------------------
    function getAuthHeader(): Record<string, string> {
        const storedUser =
            localStorage.getItem("user") || sessionStorage.getItem("user");
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

    // ----------------- Fetch Pools -----------------
    const fetchPools = async () => {
        try {
            const data: CodePools = await apiRequest("/admin/codes/all");
            setCodePools(data);
        } catch (err) {
            console.error("Error fetching pools:", err);
        }
    };

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

    useEffect(() => {
        if (authorized) fetchPools();
    }, [authorized]);

    // ----------------- Fetch Users -----------------
    const fetchUsers = async () => {
        try {
            const data = await apiRequest("/admin/users/get-users", { method: "GET" });
            const nonAdmins = data.filter((u: any) => !u.is_admin);
            setUsers(nonAdmins);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(
        (u) =>
            u.contact_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.team_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ----------------- Create/Update User -----------------
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

            let data: User;

            if (editingUser) {
                data = await apiRequest(
                    `/admin/users/update?id=${editingUser.id}&${params.toString()}`,
                    { method: "PATCH" }
                );
                toast({
                    title: "User Updated",
                    description: `Team: ${data.team_name}, User: ${data.user_name}`,
                });
            } else {
                data = await apiRequest(
                    `/admin/users/create?${params.toString()}`,
                    { method: "POST" }
                );
                toast({
                    title: "User Created",
                    description: `Team: ${data.team_name}, User: ${data.user_name}`,
                });
            }

            setTeamName("");
            setUserName("");
            setUserEmail("");
            setUserPassword("");
            setEditingUser(null);

            if (editingUser) {
                setUsers((prev) =>
                    prev.map((u) => (u.id === editingUser.id ? data : u))
                );
            } else {
                setUsers((prev) => [...prev, data]);
            }
        } catch (err: any) {
            console.error("Error creating/updating user:", err);
            toast({
                title: "Action Failed",
                description: err.message || "Please try again.",
                variant: "destructive",
            });
        }
    };

    // ----------------- Delete User -----------------
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
                const parts = err.message.split(":");
                msg = parts.length > 1 ? parts.slice(1).join(":").trim() : parts[0];
            }
            toast({
                title: "Action Failed",
                description: msg,
                variant: "destructive",
            });
        }
    }

    // ----------------- fetch countries -----------------
    useEffect(() => {
        const fetchCountries = async () => {
            const data = await apiRequest("/admin/countries");
            setCountries(data);
        };
        fetchCountries();
    }, []);

    // ----------------- Add/Delete Codes -----------------
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
                    description: `Successfully added codes: ${result.inserted.join(", ")}`,
                });
            }

            if (result.failed?.length) {
                const failedCodes = result.failed.map((f: any) => `${f[0]} (${f[1]})`);
                toast({
                    title: "Failed Codes",
                    description: `Failed to add codes: ${failedCodes.join(", ")}`,
                    variant: "destructive",
                });
            }

            setCodesText("");
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
            .map(c => c.trim())
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

        toast({
            title: "Delete Results",
            description: results.join("\n"),
        });

        setDeleteCodesText("");
    };

    // ----------------- Code Stats -----------------
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

    useEffect(() => {
        fetchCounts();
    }, []);

    // ----------------- fetch logs -----------------
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
        fetchLogs(page, filters);
    }, [page, filters]);

    if (authorized === null)
        return (
            <div className="text-center py-10 text-lg font-semibold">Loading...</div>
        );


    // **************************************************

    return (
        <main className="container py-10 space-y-8">
            {authorized === null ? (
                <div>Loading...</div>
            ) : (
                <>
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                localStorage.removeItem("user");
                                sessionStorage.removeItem("user");
                                navigate("/");
                            }}
                        >
                            Logout
                        </Button>
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
                            Admin Dashboard
                        </h1>
                        <p className="mt-2 text-muted-foreground">
                            Manage users, EK-Codes, and Activities
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Ek-codes</CardTitle>
                            </CardHeader>
                            <CardContent className="text-3xl font-semibold">
                                {totalCodes}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Used Ek-codes</CardTitle>
                            </CardHeader>
                            <CardContent className="text-3xl font-semibold">
                                {usedCodes}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Available Ek-codes</CardTitle>
                            </CardHeader>
                            <CardContent className="text-3xl font-semibold">
                                {unusedCodes}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Create/Edit Team account</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="u-name">Team name</Label>
                                    <Input
                                        id="t-name"
                                        placeholder="Enter Team name"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="u-team">User name</Label>
                                    <Input
                                        id="u-team"
                                        placeholder="Enter User name"
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="u-mail">User mail id</Label>
                                    <Input
                                        id="u-mail"
                                        type="email"
                                        placeholder="Enter User email"
                                        value={userEmail}
                                        onChange={(e) => setUserEmail(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2 relative ">
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

                        <Card className="h-full flex flex-col">
                            <CardHeader>
                                <CardTitle>Team Details</CardTitle>
                            </CardHeader>

                            <CardContent className="flex flex-col flex-1">
                                <div className="mb-3">
                                    <Input
                                        placeholder="Search User (email or team)"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="max-h-[250px] overflow-y-auto border rounded-md">
                                    <Table className="min-w-full">
                                        <TableHeader className="sticky top-0 bg-white z-10">
                                            <TableRow className="align-middle">
                                                <TableHead>Team Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Codes assigned</TableHead>
                                                <TableHead className="text-center">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {filteredUsers.length ? (
                                                filteredUsers.map((u , index) => (
                                                    <TableRow key={`${u.id || u.contact_email}_${index}`}>
                                                        <TableCell>{u.team_name}</TableCell>
                                                        <TableCell>{u.contact_email}</TableCell>
                                                        <TableCell >{u.reserved_count || 0}</TableCell>
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
                                                                >
                                                                    Edit
                                                                </Button>

                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() => setUserToDelete(u.id)}
                                                                >
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

                                <div className="mt-2 text-center font-medium">
                                    Total teams: {users.length}
                                </div>
                            </CardContent>
                            {userToDelete !== null && (
                                <div className="fixed inset-0 flex items-center justify-center z-50">
                                    <div className="absolute inset-0 backdrop-blur-sm bg-black/20"></div>
                                    <div className="relative bg-white rounded-lg p-6 shadow-lg w-80 z-10">
                                        <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
                                        <p className="mb-4">Are you sure you want to delete this user?</p>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setUserToDelete(null)}
                                            >
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

                    <Separator />

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Add Ek-code</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Select the family</Label>
                                    <RadioGroup
                                        value={selectedFamily}
                                        onValueChange={(v) => {
                                            const family = v as any;
                                            setSelectedFamily(family);
                                            if (family === "Common") {
                                                setSelectedCountry("");
                                            }
                                        }}
                                        className="flex gap-6"
                                    >
                                        {["HSV", "OSV", "Common"].map((f) => (
                                            <div key={f} className="flex items-center space-x-2">
                                                <RadioGroupItem
                                                    id={`ct-${f.toLowerCase()}`}
                                                    value={f}
                                                />
                                                <Label htmlFor={`ct-${f.toLowerCase()}`}>{f}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </div>

                                <div className="space-y-2">
                                    <Label>Select the country</Label>
                                    <select
                                        className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring focus:ring-blue-200"
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
                                    <Label htmlFor="codes">
                                        Enter one code per line, comma, or space
                                    </Label>
                                    <Textarea
                                        id="codes"
                                        value={codesText}
                                        onChange={(e) => setCodesText(e.target.value)}
                                        placeholder="Enter the code you want to add"
                                        className="min-h-[120px]"
                                    />
                                </div>

                                <Button
                                    size="sm"
                                    onClick={handleAddCodes}
                                    className="sm:w-auto w-full"
                                >
                                    Add Code
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Delete Ek-code</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="del-codes">
                                        Enter codes to delete from available (one per line, comma,
                                        or space)
                                    </Label>
                                    <Textarea
                                        id="del-codes"
                                        value={deleteCodesText}
                                        onChange={(e) => setDeleteCodesText(e.target.value)}
                                        placeholder="Enter the code you want to delete"
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

                    <Separator />

                    <Card>
                        <CardHeader>
                            <CardTitle>Ek-code Pools</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4">
                                <Input
                                    placeholder="Search codes..."
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
                                                            Available Codes:{availableCodes.length}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {availableCodes.length > 0 ? (
                                                                availableCodes
                                                                    .filter((c) =>
                                                                        c.code
                                                                            .toLowerCase()
                                                                            .includes(searchQuery.toLowerCase())
                                                                    )
                                                                    .map((c) => (
                                                                        <span
                                                                            key={c.code}
                                                                            className="px-2 py-1 rounded bg-green-100 text-green-800 font-mono text-xs"
                                                                            dangerouslySetInnerHTML={{ __html: highlight(c.code) }}
                                                                        />
                                                                    ))
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">
                                  No available codes
                                </span>
                                                            )}
                                                        </div>

                                                        <div className="text-sm font-medium mt-2">
                                                            Used Codes:{usedCodes.length}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {usedCodes.length > 0 ? (
                                                                usedCodes
                                                                    .filter((c) =>
                                                                        c.code
                                                                            .toLowerCase()
                                                                            .includes(searchQuery.toLowerCase())
                                                                    )
                                                                    .map((c) => (
                                                                        <span
                                                                            key={c.code}
                                                                            className="px-2 py-1 rounded bg-red-100 text-red-800 font-mono text-xs"
                                                                            dangerouslySetInnerHTML={{ __html: highlight(c.code) }}
                                                                        />
                                                                    ))
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">
                                  No used codes
                                </span>
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

                    <Card>
                        <CardHeader>
                            <CardTitle>Activity History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-auto">
                                <div className="rounded-lg border overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                        <tr className="text-left border-b bg-[#e2e8f0] text-base font-semibold ">
                                            {/* <tr className="text-left border-b bg-slate-100"> */}
                                            <th className="py-2 px-2">
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
                                            </th>
                                            <th className="py-2 px-2">
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
                                            <th className="py-2 px-2 align-top">
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
                                            <th className="py-2 px-2">
                                                EK-code
                                                <Input
                                                    placeholder="Filter code"
                                                    value={filters.code}
                                                    onChange={(e) => {
                                                        const trimmed = e.target.value.trim();
                                                        setFilters({ ...filters, code: trimmed });
                                                    }}
                                                    className="h-8 mt-1"
                                                />
                                            </th>
                                            <th className="py-2 px-2">Comments</th>
                                        </tr>
                                        </thead>

                                        <tbody>
                                        {logs.map((log, i) => (
                                            <tr
                                                key={log.id}
                                                className="border-b"
                                                style={{
                                                    backgroundColor: i % 2 === 0 ? "#f8fafc" : "#f1f5f9",
                                                    color: "#1f1f1f",
                                                }}
                                            >
                                                <td className="py-2 px-2 whitespace-nowrap">
                                                    {log.logged_at_str}
                                                </td>
                                                <td className="py-2 px-2">{log.user_name}</td>
                                                <td className="py-2 px-2">{log.action}</td>
                                                <td className="py-2 px-2 font-mono">{log.code}</td>
                                                <td className="py-2 px-2">{log.note || "-"}</td>
                                            </tr>
                                        ))}

                                        {!loading && logs.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="py-4 text-center text-muted-foreground"
                                                >
                                                    No records found
                                                </td>
                                            </tr>
                                        )}

                                        {loading && (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="py-4 text-center text-muted-foreground"
                                                >
                                                    Loading...
                                                </td>
                                            </tr>
                                        )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex justify-center items-center gap-4 mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                    disabled={page === 1}
                                >
                                    Previous
                                </Button>
                                <span>
                  Page {page} of {totalPages || 1}
                </span>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (page < totalPages) setPage(page + 1);
                                        else alert("No more records");
                                    }}
                                    disabled={page >= totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    <Separator />
                </>
            )
            }
        </main >
    );
}