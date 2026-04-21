import { useState, useEffect } from "react";
import { Leaf, ChevronLeft, ChevronRight, Loader2, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Slot = { date: string; time: string; label: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function parseUsername(): string {
  const parts = window.location.pathname.split("/");
  return parts[2] || "";
}

export default function BookingPage() {
  const username = parseUsername();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [profile, setProfile] = useState<{ name: string; title: string } | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [step, setStep] = useState<"calendar" | "form" | "done">("calendar");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    address: "", service_type: "", notes: "",
  });

  useEffect(() => {
    if (!username) {
      setError("Invalid booking link.");
      setLoading(false);
      return;
    }

    const from = new Date();
    from.setDate(from.getDate() + 1);
    const to = new Date(from);
    to.setDate(to.getDate() + 28);

    const params = new URLSearchParams({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
    });

    fetch(`/api/book/${username}/slots?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSlots(data.slots || []);
        setProfile(data.profile || { name: username, title: "Sales Consultant" });
      })
      .catch(err => setError(err.message || "Could not load availability."))
      .finally(() => setLoading(false));
  }, [username]);

  // Group slots by date
  const slotsByDate: Record<string, Slot[]> = {};
  for (const s of slots) {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  }

  // Build calendar
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  function dayKey(d: number) {
    const mm = String(calMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${calYear}-${mm}-${dd}`;
  }

  function handleDayClick(d: number) {
    const key = dayKey(d);
    if (slotsByDate[key]) {
      setSelectedDate(key);
      setSelectedTime("");
    }
  }

  async function handleBook() {
    setFormError("");
    if (!form.first_name || !form.last_name || !form.email) {
      setFormError("Please fill in your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/book/${username}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          date: selectedDate,
          time: selectedTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      setStep("done");
    } catch (err: any) {
      setFormError(err.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const todayStr = today.toISOString().split("T")[0];
  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] || []) : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Booking Unavailable</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center">
              <Leaf className="h-6 w-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-green-800">Chapin Landscapes</h1>
              <p className="text-xs text-green-600">Professional Landscape Management</p>
            </div>
          </div>
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-14 w-14 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Consultation Booked!</h2>
            <p className="text-gray-500 mt-2">
              Your consultation has been scheduled for{" "}
              <strong>{fmtDate(new Date(selectedDate + "T12:00:00"))} at {
                slots.find(s => s.date === selectedDate && s.time === selectedTime)?.label || selectedTime
              }</strong>.
            </p>
            <p className="text-gray-500 mt-2">
              {profile?.name} will be in touch to confirm your appointment.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/inquiry"}
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-green-800">Chapin Landscapes</h1>
            <p className="text-xs text-green-600">Book a Consultation</p>
          </div>
        </div>

        {profile && (
          <div className="mb-6 p-4 bg-white rounded-xl border shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-green-200 rounded-full flex items-center justify-center text-green-800 text-xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-gray-800">{profile.name}</div>
              <div className="text-sm text-gray-500">{profile.title || "Sales Consultant"}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <Clock className="h-3 w-3" /> 60-minute consultation
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar */}
          <Card className="shadow-sm">
            <CardContent className="p-5">
              {step === "calendar" && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h3 className="font-bold text-gray-700">{MONTHS[calMonth]} {calYear}</h3>
                    <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAYS.map(d => (
                      <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((d, i) => {
                      if (!d) return <div key={i} />;
                      const key = dayKey(d);
                      const hasSlots = !!slotsByDate[key];
                      const isPast = key < todayStr;
                      const isSelected = key === selectedDate;
                      return (
                        <button
                          key={i}
                          disabled={!hasSlots || isPast}
                          onClick={() => handleDayClick(d)}
                          data-testid={`cal-day-${key}`}
                          className={`
                            rounded-lg py-2 text-sm font-medium transition-colors
                            ${isSelected ? "bg-green-700 text-white" : ""}
                            ${hasSlots && !isPast && !isSelected ? "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer" : ""}
                            ${(!hasSlots || isPast) && !isSelected ? "text-gray-300 cursor-not-allowed" : ""}
                          `}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-green-100 rounded"></span> Available
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-green-700 rounded"></span> Selected
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Time slots / form */}
          <div className="space-y-4">
            {selectedDate && step === "calendar" && (
              <Card className="shadow-sm">
                <CardContent className="p-5">
                  <h3 className="font-bold text-gray-700 mb-3">
                    {fmtDate(new Date(selectedDate + "T12:00:00"))}
                  </h3>
                  {selectedSlots.length === 0 ? (
                    <p className="text-sm text-gray-400">No available times on this date.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedSlots.map(s => (
                        <button
                          key={s.time}
                          onClick={() => { setSelectedTime(s.time); setStep("form"); }}
                          data-testid={`slot-${s.date}-${s.time}`}
                          className="py-2 px-3 border rounded-lg text-sm font-medium hover:bg-green-700 hover:text-white hover:border-green-700 transition-colors text-gray-700"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!selectedDate && (
              <div className="flex items-center justify-center h-40 text-center text-gray-400 text-sm">
                <div>
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Select a date to see available times
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booking Form */}
        {step === "form" && (
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => { setStep("calendar"); setSelectedTime(""); }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {fmtDate(new Date(selectedDate + "T12:00:00"))} at{" "}
                  {slots.find(s => s.date === selectedDate && s.time === selectedTime)?.label || selectedTime}
                </Badge>
              </div>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-gray-700">Your Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>First Name *</Label>
                    <Input value={form.first_name} onChange={e => f("first_name", e.target.value)} data-testid="input-first-name" />
                  </div>
                  <div className="space-y-1">
                    <Label>Last Name *</Label>
                    <Input value={form.last_name} onChange={e => f("last_name", e.target.value)} data-testid="input-last-name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Email *</Label>
                    <Input type="email" value={form.email} onChange={e => f("email", e.target.value)} data-testid="input-email" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input type="tel" value={form.phone} onChange={e => f("phone", e.target.value)} data-testid="input-phone" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Property Address</Label>
                  <Input value={form.address} onChange={e => f("address", e.target.value)} data-testid="input-address" />
                </div>
                <div className="space-y-1">
                  <Label>Notes (optional)</Label>
                  <Textarea rows={2} value={form.notes} onChange={e => f("notes", e.target.value)} data-testid="input-notes" />
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                    {formError}
                  </div>
                )}

                <Button
                  onClick={handleBook}
                  disabled={submitting}
                  className="w-full bg-green-700 hover:bg-green-800 text-white"
                  data-testid="btn-confirm-booking"
                >
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Booking...</> : "Confirm Consultation"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} Chapin Landscapes LLC — All rights reserved
        </p>
      </div>
    </div>
  );
}
