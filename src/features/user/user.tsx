"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/card";
import { Input } from "../../components/input";
import { Textarea } from "../../components/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/dialog";
import { useToast } from "../../components/use-toast";

/* Icons */
import {
    LogOut,
    KeyRound,
    Undo2,
    ShieldCheck,
    Copy,
    Globe2,
    UserRound,
    BadgeCheck,
    FileClock,
    Mail,
    Search,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE as string;

/* ---------------- API Request ---------------- */
async function apiRequest(
    endpoint: string,
    body:
        | {
        tester_name?: string;
        country?: string;
        code_type?: string;
        code?: string;
        note?: string | undefined;
        clearance_id?: string;
    }
        | undefined,
    method: "GET" | "POST" = "POST"
) {
    const storedUser = localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;
    if (!user?.token) throw new Error("User not authenticated");

    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
        },
        body: method === "GET" ? undefined : body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const errData = await res.text();
        throw new Error(errData || `API request failed: ${res.status}`);
    }

    return res.json();
}

/* ---------------- Utilities ---------------- */
function formatLocalDate(date: string | Date) {
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
    "Australia","Austria","Belgium","Bulgaria","Canada","Cyprus","Czech Republic","Denmark","Estonia","Finland","France","Germany","Greece","Hong Kong","Hungary","Ireland","Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Norway","NZ","Poland","Portugal","Puerto Rico","Romania","Singapore","Slovakia","Slovenia","Spain","Sweden","Switzerland","UK","US",
];

function detectRegion(country: string) {
    const c = country.trim().toLowerCase();
    const sets: Record<string, string[]> = {
        NA: ["us", "canada", "puerto rico"],
        EU: ["spain","italy","germany","france","portugal","netherlands","hungary","ireland","austria","luxembourg","sweden","lithuania","czech republic","uk","switzerland","cyprus","slovakia","estonia","malta","latvia","romania","greece","slovenia","poland","bulgaria","norway","denmark","finland","belgium"],
        AP: ["australia", "singapore", "hong kong", "nz"],
    };
    for (const [key, vals] of Object.entries(sets)) if (vals.includes(c)) return key;
    return "";
}

/* ---------------- Searchable Country Select ---------------- */
function SearchableSelect({
                              value, onChange, options, placeholder,
                          }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("");
    const filteredOptions = options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()));

    return (
        <div className="relative w-full">
            <div className="relative">
                <Input
                    value={value}
                    placeholder={placeholder}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 120)}
                    onChange={(e) => { setFilter(e.target.value); onChange(e.target.value); }}
                    className="pl-9"
                />
                <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
            {open && filteredOptions.length > 0 && (
                <ul className="absolute z-10 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-md mt-1 text-sm">
                    {filteredOptions.map((opt) => (
                        <li
                            key={opt}
                            className="px-3 py-2 hover:bg-indigo-50 cursor-pointer transition"
                            onMouseDown={() => { onChange(opt); setOpen(false); setFilter(""); }}
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/* ---------------- Small UI bits ---------------- */
const ActionBadge = ({ action }: { action: string }) => {
    const A = (action || "").toUpperCase();
    const styles: Record<string, string> = {
        RESERVED: "bg-rose-100 text-rose-700 border-rose-200",
        RELEASED: "bg-emerald-100 text-emerald-700 border-emerald-200",
        ADDED: "bg-sky-100 text-sky-700 border-sky-200",
        DELETED: "bg-slate-100 text-slate-700 border-slate-200",
    };
    const cls = styles[A] || "bg-slate-100 text-slate-700 border-slate-200";
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${cls}`}>
      {A === "RESERVED" && <KeyRound className="h-3.5 w-3.5" />}
            {A === "RELEASED" && <BadgeCheck className="h-3.5 w-3.5" />}
            {A === "ADDED" && <FileClock className="h-3.5 w-3.5" />}
            {A === "DELETED" && <FileClock className="h-3.5 w-3.5" />}
            {A || "-"}
    </span>
    );
};

/* ---------------- Main Component ---------------- */
export default function UserPage() {
    const { toast } = useToast();

    const [teamMember, setTeamMember] = useState("");
    const [country, setCountry] = useState("");
    const [region, setRegion] = useState("");
    const [selectedType, setSelectedType] = useState<"HSV" | "OSV">("HSV");

    const [generatedCode, setGeneratedCode] = useState("");
    const [submitCode, setSubmitCode] = useState("");
    const [submitComments, setSubmitComments] = useState("");
    const [confirmCode, setConfirmCode] = useState("");
    const [clearanceId, setClearanceId] = useState("");
    const [confirmTouched, setConfirmTouched] = useState(false);
    const [clearanceTouched, setClearanceTouched] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);

    const [history, setHistory] = useState<any[]>([]);
    const [reserved, setReserved] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => { if (country) setRegion(detectRegion(country)); }, [country]);

    async function copyToClipboard(text: string) {
        try { await navigator.clipboard.writeText(text); return true; }
        catch {
            const el = document.createElement("textarea");
            el.value = text; document.body.appendChild(el); el.select();
            const ok = document.execCommand("copy"); document.body.removeChild(el); return ok;
        }
    }

    const fetchLogs = useCallback(async () => {
        try { const data = await apiRequest("/users/logs", undefined, "GET"); setHistory(Array.isArray(data) ? data : data.logs || []); }
        catch (err: any) { toast({ title: "Failed to fetch logs", description: err.message, duration: 2000 }); }
    }, [toast]);

    const fetchReserved = useCallback(async () => {
        try { const data = await apiRequest("/users/my", undefined, "GET"); setReserved(Array.isArray(data) ? data : []); }
        catch (err: any) { toast({ title: "Failed to fetch reserved codes", description: err.message, duration: 2000 }); }
    }, [toast]);

    useEffect(() => { fetchLogs(); fetchReserved(); }, [fetchLogs, fetchReserved]);

    const handleGenerate = useCallback(async () => {
        if (!teamMember || !country) return toast({ title: "Enter team member and country", duration: 2000 });
        if (!region) return toast({ title: "Unsupported country", duration: 2000 });

        try {
            const data = await apiRequest("/users/reserve", { tester_name: teamMember, country, code_type: selectedType });
            setGeneratedCode(data.code);
            setDialogOpen(true);
            await copyToClipboard(data.code);
            toast({ title: "Copied to clipboard", description: data.code, duration: 2000 });
            fetchLogs(); fetchReserved();
        } catch {
            toast({ title: "No EK-codes available", description: "No EK-codes available right now.", duration: 2000 });
        }
    }, [teamMember, country, region, selectedType, fetchLogs, fetchReserved, toast]);

    const handleSubmitBack = useCallback(async () => {
        if (!submitCode.trim()) return toast({ title: "Enter a code", duration: 2000 });
        try {
            await apiRequest("/users/release", { code: submitCode.trim(), note: submitComments?.trim() || undefined });
            toast({ title: "Code submitted back", duration: 2000 });
            setSubmitCode(""); setSubmitComments("");
            fetchLogs(); fetchReserved();
        } catch (err: any) { toast({ title: "Submit failed", description: err.message, duration: 2000 }); }
    }, [submitCode, submitComments, fetchLogs, fetchReserved, toast]);

    const handleClear = useCallback(async () => {
        setConfirmTouched(true); setClearanceTouched(true);
        if (!confirmCode.trim() || !clearanceId.trim()) return;
        try {
            await apiRequest("/users/release", { code: confirmCode.trim(), clearance_id: clearanceId.trim() });
            toast({ title: "Code cleared", duration: 2000 });
            setConfirmCode(""); setClearanceId(""); setConfirmTouched(false); setClearanceTouched(false);
            fetchLogs(); fetchReserved();
        } catch (err: any) { toast({ title: "Clear failed", description: err.message, duration: 2000 }); }
    }, [confirmCode, clearanceId, fetchLogs, fetchReserved, toast]);

    const onLogout = async () => {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${JSON.parse(localStorage.getItem("user") || "{}").token}` },
            });
            localStorage.clear(); window.location.href = "/";
        } catch { toast({ title: "Logout failed", description: "Logout Failed, Contact Admin", duration: 2000 }); }
    };

    const filteredHistory = history.filter((h) =>
        searchQuery ? JSON.stringify(h).toLowerCase().includes(searchQuery.toLowerCase()) : true
    );

    const clearDisabled = !confirmCode.trim() || !clearanceId.trim();

    /* ---------------- Render ---------------- */
    return (
        <main className="container py-10 font-sans text-slate-800">
            {/* Top bar */}
            <div className="flex justify-end items-center mb-6">
                {/*<div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100">*/}
                {/*    <Globe2 className="h-3.5 w-3.5" />*/}
                {/*    EK User Console*/}
                {/*</div>*/}
                <Button
                    variant="outline"
                    onClick={onLogout}
                    className="text-sm font-medium px-3.5 py-2 border-slate-300 hover:bg-rose-50 hover:text-rose-600"
                >
                    <LogOut className="h-4 w-6 mr-1.5" />
                    Logout
                </Button>
            </div>

            <div className="mb-8 md:mb-12 text-center">
                {/*<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 text-xs font-semibold mb-3">*/}
                {/*    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />*/}
                {/*    EK Code Manager*/}
                {/*</div>*/}

                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight
                 bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500
                 bg-clip-text text-transparent py-0.5">
                    Manage Ek-Codes
                </h1>

                <p className="mt-0 md:mt-0 text-sm md:text-base text-slate-600">
                    Reserve, clear, and return codes with a few clicks.
                </p>
            </div>

            {/* Generated code dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-white text-black rounded-2xl shadow-xl border border-slate-200 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-center text-slate-800">Generated Ek-Code</DialogTitle>
                        <DialogDescription className="text-slate-600 text-center">Copy and keep it safe</DialogDescription>
                    </DialogHeader>
                    {generatedCode && (
                        <div className="text-center mt-4">
                            <div className="border-2 border-slate-200 bg-slate-50 text-slate-900 font-mono text-2xl font-bold tracking-wider rounded-lg py-4 px-6 select-all inline-flex items-center gap-2 justify-center shadow-sm">
                                {generatedCode}
                            </div>
                            <div className="mt-6 flex gap-3 justify-center">
                                <Button
                                    onClick={async () => { await copyToClipboard(generatedCode); setDialogOpen(false); toast({ title: "Copied", duration: 2000 }); }}
                                >
                                    <Copy className="h-4 w-4 mr-1.5" />
                                    Copy & Close
                                </Button>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Three equal-height cards with bottom-aligned buttons */}
            <div className="grid gap-6 md:grid-cols-3 items-stretch">
                {/* Generate */}
                <Card className="border border-slate-200 hover:shadow-lg transition rounded-xl h-full flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-slate-800 inline-flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-indigo-600" />
                            Get Ek-Code
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 h-full">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium inline-flex items-center gap-1.5">
                                <UserRound className="h-4 w-4 text-slate-400" />
                                Team member <span className="text-rose-600">*</span>
                            </label>
                            <Input value={teamMember} onChange={(e) => setTeamMember(e.target.value)} placeholder="Team member" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Country <span className="text-rose-600">*</span></label>
                            <SearchableSelect value={country} onChange={setCountry} options={countries} placeholder="Select country" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Region <span className="text-rose-600">*</span></label>
                            <Input value={region} placeholder="Region" disabled />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Type</label>
                            <div className="flex gap-4">
                                {(["HSV", "OSV"] as const).map((t) => (
                                    <label key={t} className="flex items-center gap-2 text-sm">
                                        <input type="radio" name="ekType" value={t} checked={selectedType === t} onChange={() => setSelectedType(t)} />
                                        {t}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-auto" />
                        <Button onClick={handleGenerate} className="w-full mt-2">
                            {/*<KeyRound className="h-4 w-4 mr-1.5" />*/}
                            Get Code
                        </Button>
                    </CardContent>
                </Card>

                {/* Submit Back */}
                <Card className="border border-slate-200 hover:shadow-lg transition rounded-xl h-full flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-slate-800 inline-flex items-center gap-2">
                            <Undo2 className="h-4 w-4 text-violet-600" />
                            Submit Back
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 h-full">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Code <span className="text-rose-600">*</span></label>
                            <Input value={submitCode} onChange={(e) => setSubmitCode(e.target.value)} placeholder="Enter the code" className="font-mono" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Comments (optional)</label>
                            <Textarea value={submitComments} onChange={(e) => setSubmitComments(e.target.value)} placeholder="Comments (optional)" className="min-h-[96px]" />
                        </div>

                        <div className="mt-auto" />
                        <Button onClick={handleSubmitBack} className="w-full mt-2">
                            {/*<Undo2 className="h-4 w-4 mr-1.5" />*/}
                            Submit
                        </Button>
                    </CardContent>
                </Card>

                {/* Clear Code */}
                <Card className="border border-slate-200 hover:shadow-lg transition rounded-xl h-full flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-slate-800 inline-flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-fuchsia-600" />
                            Clear Code
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 h-full">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                Code <span className="text-rose-600">*</span>
                            </label>
                            <Input
                                value={confirmCode}
                                onChange={(e) => setConfirmCode(e.target.value)}
                                onBlur={() => setConfirmTouched(true)}
                                placeholder="Enter the code"
                                className={`font-mono ${confirmTouched && !confirmCode.trim() ? "border-rose-400 focus:ring-rose-300" : ""}`}
                                aria-required="true"
                            />
                            {confirmTouched && !confirmCode.trim() && <p className="text-xs text-rose-600">Code is required.</p>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                Clearance ID <span className="text-rose-600">*</span>
                            </label>
                            <Input
                                value={clearanceId}
                                onChange={(e) => setClearanceId(e.target.value)}
                                onBlur={() => setClearanceTouched(true)}
                                placeholder="Enter the clearance ID"
                                className={`${clearanceTouched && !clearanceId.trim() ? "border-rose-400 focus:ring-rose-300" : ""}`}
                                aria-required="true"
                            />
                            {clearanceTouched && !clearanceId.trim() && <p className="text-xs text-rose-600">Clearance ID is required.</p>}
                        </div>

                        <div className="mt-auto" />
                        <Button onClick={handleClear} disabled={clearDisabled} className="w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
                            {/*<ShieldCheck className="h-4 w-4 mr-1.5" />*/}
                            Clear
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Reserved Codes */}
            <section className="mt-12">
                <div className="flex items-center gap-2 mb-3">
                    <BadgeCheck className="h-4 w-4 text-indigo-600" />
                    <h2 className="text-lg font-semibold">My Reserved Codes</h2>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                        <tr>
                            {["Code", "Tester Name", "Requested At", "Status"].map((h) => (
                                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {reserved.length ? reserved.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-2 font-mono">{r.code}</td>
                                <td className="px-4 py-2">{r.tester_name || "-"}</td>
                                <td className="px-4 py-2">{r.requested_at ? formatLocalDate(r.requested_at) : "-"}</td>
                                <td className="px-4 py-2"><ActionBadge action={r.status || "-"} /></td>
                            </tr>
                        )) : (
                            <tr><td colSpan={4} className="text-center py-4 text-slate-500">No reserved codes</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Logs */}
            <section className="mt-12">
                <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex items-center gap-2">
                        <FileClock className="h-4 w-4 text-violet-600" />
                        <h2 className="text-lg font-semibold">My Logs</h2>
                    </div>
                    <div className="relative max-w-xs w-full">
                        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search logs..." className="pl-9 text-sm" />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                        <tr>
                            {["Code", "Action", "User Name", "Tester Name", "Email", "Comments", "Logged At"].map((h) => (
                                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {filteredHistory.length ? filteredHistory.map((h, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition">
                                <td className="px-4 py-2 font-mono">{h.code || "-"}</td>
                                <td className="px-4 py-2"><ActionBadge action={h.action || "-"} /></td>
                                <td className="px-4 py-2">{h.user_name || "-"}</td>
                                <td className="px-4 py-2">{h.tester_name || "-"}</td>
                                <td className="px-4 py-2 inline-flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                                    {h.contact_email || "-"}
                                </td>
                                <td className="px-4 py-2">{h.note || "-"}</td>
                                <td className="px-4 py-2">{h.logged_at ? formatLocalDate(h.logged_at) : "-"}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan={7} className="text-center py-4 text-slate-500">No logs found</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}