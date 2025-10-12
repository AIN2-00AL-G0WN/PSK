"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/card";
import { Input } from "../../components/input";
import { Textarea } from "../../components/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/dialog";
import { useToast } from "../../components/use-toast";

const API_BASE = import.meta.env.VITE_API_BASE;

// ---------------- API Request ----------------
async function apiRequest(endpoint, body, method = "POST") {
    const storedUser = localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;
    if (!user?.token) throw new Error("User not authenticated");

    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const errData = await res.text();
        throw new Error(errData || `API request failed: ${res.status}`);
    }

    return res.json();
}

// ---------------- Utilities ----------------
function formatLocalDate(date) {
    const d = new Date(date);
    return d.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

const countries = [
    "Australia", "Austria", "Belgium", "Bulgaria", "Canada", "Cyprus", "Czech Republic",
    "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hong Kong",
    "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta",
    "Netherlands", "Norway", "NZ", "Poland", "Portugal", "Puerto Rico", "Romania",
    "Singapore", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "UK", "US"
];

function detectRegion(country) {
    const c = country.trim().toLowerCase();
    const sets = {
        NA: ["us", "canada", "puerto rico"],
        EU: ["spain", "italy", "germany", "france", "portugal", "netherlands", "hungary", "ireland", "austria", "luxembourg", "sweden", "lithuania", "czech republic", "uk", "switzerland", "cyprus", "slovakia", "estonia", "malta", "latvia", "romania", "greece", "slovenia", "poland", "bulgaria", "norway", "denmark", "finland", "belgium"],
        AP: ["australia", "singapore", "hong kong", "nz"],
    };
    for (const [key, vals] of Object.entries(sets)) if (vals.includes(c)) return key;
    return "";
}

// ---------------- Searchable Country Select ----------------
function SearchableSelect({ value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("");

    const filteredOptions = options.filter(o =>
        o.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="relative w-full">
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                    setFilter(e.target.value);
                    onChange(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none transition"
            />
            {open && filteredOptions.length > 0 && (
                <ul className="absolute z-10 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-md mt-1 text-sm">
                    {filteredOptions.map((opt) => (
                        <li
                            key={opt}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer transition"
                            onClick={() => {
                                onChange(opt);
                                setOpen(false);
                                setFilter("");
                            }}
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ---------------- Main Component ----------------
export default function UserPage() {
    const { toast } = useToast();

    const [teamMember, setTeamMember] = useState("");
    const [country, setCountry] = useState("");
    const [region, setRegion] = useState("");
    const [selectedType, setSelectedType] = useState("HSV");

    const [generatedCode, setGeneratedCode] = useState("");
    const [submitCode, setSubmitCode] = useState("");
    const [submitComments, setSubmitComments] = useState("");
    const [confirmCode, setConfirmCode] = useState("");
    const [clearanceId, setClearanceId] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);

    const [history, setHistory] = useState([]);
    const [reserved, setReserved] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => { if (country) setRegion(detectRegion(country)); }, [country]);

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            const el = document.createElement("textarea");
            el.value = text;
            document.body.appendChild(el);
            el.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(el);
            return ok;
        }
    }

    const fetchLogs = useCallback(async () => {
        try {
            const data = await apiRequest("/users/logs", undefined, "GET");
            setHistory(Array.isArray(data) ? data : data.logs || []);
        } catch (err) {
            toast({ title: "Failed to fetch logs", description: err.message,className: "bg-black text-white",duration:2000 });
        }
    }, [toast]);

    const fetchReserved = useCallback(async () => {
        try {
            const data = await apiRequest("/users/my", undefined, "GET");
            setReserved(Array.isArray(data) ? data : []);
        } catch (err) {
            toast({ title: "Failed to fetch reserved codes", description: err.message,className: "bg-black text-white",duration:2000 });
        }
    }, [toast]);

    useEffect(() => { fetchLogs(); fetchReserved(); }, [fetchLogs, fetchReserved]);

    const handleGenerate = useCallback(async () => {
        if (!teamMember || !country) return toast({ title: "Enter team member and country",duration:2000, });
        if (!region) return toast({ title: "Unsupported country" });

        try {
            const data = await apiRequest("/users/reserve", { tester_name: teamMember, country, code_type: selectedType });
            setGeneratedCode(data.code);
            setDialogOpen(true);
            await copyToClipboard(data.code);
            toast({ title: "Copied to clipboard", description: data.code,duration:2000,className: "bg-black text-white", });
            fetchLogs();
            fetchReserved();
        } catch (err) {
            toast({ title: "No EK-codes available", description: "No EK-codes available right now.",duration:2000,className: "bg-black text-white", });
        }
    }, [teamMember, country, region, selectedType]);

    const handleSubmitBack = useCallback(async () => {
        if (!submitCode) return toast({ title: "Enter a code",duration:2000,className: "bg-black text-white", });
        try {
            await apiRequest("/users/release", { code: submitCode, note: submitComments || undefined });
            toast({ title: "Code submitted back",duration:2000,className: "bg-black text-white", });
            setSubmitCode(""); setSubmitComments("");
            fetchLogs(); fetchReserved();
        } catch (err) { toast({ title: "Submit failed", description: err.message,duration:2000,className: "bg-black text-white", }); }
    }, [submitCode, submitComments]);

    const handleClear = useCallback(async () => {
        if (!confirmCode || !clearanceId) return toast({ title: "Enter code and clearance ID",duration:2000,className: "bg-black text-white", });
        try {
            await apiRequest("/users/release", { code: confirmCode, clearance_id: clearanceId });
            toast({ title: "Code cleared",duration:2000,className: "bg-black text-white", });
            setConfirmCode(""); setClearanceId("");
            fetchLogs(); fetchReserved();
        } catch (err) { toast({ title: "Clear failed", description: err.message,duration:2000,className: "bg-black text-white", }); }
    }, [confirmCode, clearanceId]);

    const onLogout = async () => {
        try {
            await fetch(`${API_BASE}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${JSON.parse(localStorage.getItem("user") || "{}").token}` } });
            localStorage.clear(); window.location.href = "/";
        } catch (err) { toast({ title: "Logout failed", description: "Logout Failed,Contact Admin",duration:2000,className: "bg-black text-white", }); }
    };

    const filteredHistory = history.filter(h =>
        searchQuery ? JSON.stringify(h).toLowerCase().includes(searchQuery.toLowerCase()) : true
    );

    return (
        <main className="container py-10 font-inter text-gray-800">
            {/* Logout */}
            <div className="flex justify-end mb-6">
                <Button variant="outline" onClick={onLogout} className="text-sm font-medium px-4 py-2 border-gray-300 hover:bg-red-100 hover:text-red-600">
                    Logout
                </Button>
            </div>

            <div className="text-center mb-10">
                <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-500 bg-clip-text text-transparent">
                    Manage Ek-Codes
                </h1>
                <p className="text-gray-500 mt-2 text-sm">Get and release Ek-Codes</p>
            </div>

            {/* Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-white text-black rounded-2xl shadow-xl border border-gray-200 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-center text-gray-800">Generated Ek-Code</DialogTitle>
                        <DialogDescription className="text-gray-600 text-center">Copy and keep it safe</DialogDescription>
                    </DialogHeader>
                    {generatedCode && (
                        <div className="text-center mt-4">
                            <div className="border-2 border-gray-200 bg-gray-50 text-gray-900 font-mono text-2xl font-bold tracking-wider rounded-lg py-4 px-6 select-all inline-block shadow-sm">
                                {generatedCode}
                            </div>
                            <div className="mt-6 flex gap-3 justify-center">
                                <Button onClick={async () => { await copyToClipboard(generatedCode); setDialogOpen(false); toast({ title: "Copied",duration:2000,className: "bg-black text-white", }); }}>
                                    Copy & Close
                                </Button>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                {[
                    {
                        title: "Generate Ek-Code",
                        content: (
                            <>
                                <Input value={teamMember} onChange={(e) => setTeamMember(e.target.value)} placeholder="Team member" />
                                <SearchableSelect value={country} onChange={setCountry} options={countries} placeholder="Select country" />
                                <Input value={region} placeholder="Region" disabled />
                                <div className="flex gap-4 mt-2">
                                    {["HSV", "OSV"].map(t => (
                                        <label key={t} className="flex items-center gap-2">
                                            <input type="radio" name="ekType" value={t} checked={selectedType === t} onChange={() => setSelectedType(t)} />
                                            <span className="text-sm">{t}</span>
                                        </label>
                                    ))}
                                </div>
                                <Button onClick={handleGenerate} className="w-full mt-2">Generate</Button>
                            </>
                        )
                    },
                    {
                        title: "Submit Back",
                        content: (
                            <>
                                <Input value={submitCode} onChange={(e) => setSubmitCode(e.target.value)} placeholder="Code" className="font-mono" />
                                <Textarea value={submitComments} onChange={(e) => setSubmitComments(e.target.value)} placeholder="Comments (optional)" />
                                <Button onClick={handleSubmitBack} className="w-full mt-2">Submit</Button>
                            </>
                        )
                    },
                    {
                        title: "Clear Code",
                        content: (
                            <>
                                <Input value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} placeholder="Code" className="font-mono" />
                                <Input value={clearanceId} onChange={(e) => setClearanceId(e.target.value)} placeholder="Clearance ID" />
                                <Button onClick={handleClear} disabled={!confirmCode || !clearanceId} className="w-full mt-2">Clear</Button>
                            </>
                        )
                    },
                ].map((c, i) => (
                    <Card key={i} className="border border-gray-200 hover:shadow-lg transition rounded-xl">
                        <CardHeader><CardTitle className="text-lg font-semibold text-gray-800">{c.title}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">{c.content}</CardContent>
                    </Card>
                ))}
            </div>

            {/* Reserved Codes */}
            <section className="mt-12">
                <h2 className="text-lg font-semibold mb-3">My Reserved Codes</h2>
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                        <tr>
                            {["Code", "Tester Name", "Requested At", "Status"].map((h) => (
                                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {reserved.length ? reserved.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-mono">{r.code}</td>
                                <td className="px-4 py-2">{r.tester_name || "-"}</td>
                                <td className="px-4 py-2">{r.requested_at ? formatLocalDate(r.requested_at) : "-"}</td>
                                <td className="px-4 py-2">{r.status || "-"}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={4} className="text-center py-4 text-gray-500">No reserved codes</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Logs */}
            <section className="mt-12">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">My Logs</h2>
                    <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search logs..." className="max-w-xs text-sm" />
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                        <tr>
                            {["Code", "Action", "User Name", "Tester Name", "Comments", "Note", "Logged At"].map((h) => (
                                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                        {filteredHistory.length ? filteredHistory.map((h, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition">
                                <td className="px-4 py-2 font-mono">{h.code || "-"}</td>
                                <td className="px-4 py-2">{h.user_name || "-"}</td>
                                <td className="px-4 py-2">{h.tester_name || "-"}</td>
                                <td className="px-4 py-2">{h.contact_email || "-"}</td>
                                <td className="px-4 py-2">{h.note || "-"}</td>
                                <td className={`px-4 py-2 font-bold ${h.action === "RESERVED" ? "text-red-600" : "text-green-600"}`}>{h.action || "-"}</td>
                                <td className="px-4 py-2">{h.logged_at ? formatLocalDate(h.logged_at) : "-"}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={9} className="text-center py-4 text-gray-500">No logs found</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}