import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Calendar, Leaf, Clock, Coffee, Plus, Trash2, Save, CheckCircle2, MapPin, Sprout } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const US_FEDERAL_HOLIDAYS = [
  { key: "new_years",    name: "New Year's Day",    detail: "January 1" },
  { key: "mlk",         name: "MLK Day",            detail: "3rd Monday in January" },
  { key: "presidents",  name: "Presidents' Day",    detail: "3rd Monday in February" },
  { key: "memorial",    name: "Memorial Day",       detail: "Last Monday in May" },
  { key: "juneteenth",  name: "Juneteenth",         detail: "June 19" },
  { key: "independence",name: "Independence Day",   detail: "July 4" },
  { key: "labor",       name: "Labor Day",          detail: "1st Monday in September" },
  { key: "columbus",    name: "Columbus Day",       detail: "2nd Monday in October" },
  { key: "veterans",    name: "Veterans Day",       detail: "November 11" },
  { key: "thanksgiving",name: "Thanksgiving",       detail: "4th Thursday in November" },
  { key: "christmas",   name: "Christmas Day",      detail: "December 25" },
];

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useAppSetting(key: string) {
  return useQuery({
    queryKey: [`/api/settings/${key}`],
    queryFn: async () => {
      const res = await fetch(`/api/settings/${key}`, { credentials: "include" });
      if (!res.ok) return null;
      const d = await res.json();
      return d?.value ? JSON.parse(d.value) : null;
    },
    retry: false,
    staleTime: 30_000,
  });
}

function useSaveAppSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const res = await apiRequest("PUT", `/api/settings/${key}`, { value: JSON.stringify(value) });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to save");
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [`/api/settings/${vars.key}`] });
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function SaveBadge({ saved }: { saved: boolean }) {
  if (!saved) return null;
  return (
    <Badge variant="outline" className="text-green-600 border-green-500 gap-1">
      <CheckCircle2 className="h-3 w-3" /> Saved
    </Badge>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RegionalSettingsPage() {
  const { toast } = useToast();
  const save = useSaveAppSetting();

  // ── A1: Weather Location ───────────────────────────────────────────────────
  const { data: weatherLoc } = useAppSetting("weather_location");
  const [weatherCity, setWeatherCity] = useState("");
  const [weatherLat, setWeatherLat] = useState("");
  const [weatherLng, setWeatherLng] = useState("");
  const [weatherSaved, setWeatherSaved] = useState(false);

  useEffect(() => {
    if (weatherLoc) {
      setWeatherCity(weatherLoc.city ?? "");
      setWeatherLat(String(weatherLoc.lat ?? ""));
      setWeatherLng(String(weatherLoc.lng ?? ""));
    }
  }, [weatherLoc]);

  async function saveWeather() {
    const lat = parseFloat(weatherLat);
    const lng = parseFloat(weatherLng);
    if (!weatherCity.trim()) { toast({ title: "Enter a city name", variant: "destructive" }); return; }
    if (!isFinite(lat) || lat < -90 || lat > 90) { toast({ title: "Latitude must be between -90 and 90", variant: "destructive" }); return; }
    if (!isFinite(lng) || lng < -180 || lng > 180) { toast({ title: "Longitude must be between -180 and 180", variant: "destructive" }); return; }
    await save.mutateAsync({ key: "weather_location", value: { city: weatherCity.trim(), lat, lng } });
    setWeatherSaved(true);
    setTimeout(() => setWeatherSaved(false), 3000);
    toast({ title: "Weather location saved" });
  }

  // ── A2: Holiday Management ─────────────────────────────────────────────────
  const { data: holidayCfg } = useAppSetting("holiday_config");
  const [observedHolidays, setObservedHolidays] = useState<string[]>([]);
  const [holidaySaved, setHolidaySaved] = useState(false);

  useEffect(() => {
    if (holidayCfg && Array.isArray(holidayCfg.observed)) {
      setObservedHolidays(holidayCfg.observed);
    } else if (holidayCfg === null) {
      // Default: observe all federal holidays
      setObservedHolidays(US_FEDERAL_HOLIDAYS.map(h => h.key));
    }
  }, [holidayCfg]);

  function toggleHoliday(key: string) {
    setObservedHolidays(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function saveHolidays() {
    await save.mutateAsync({ key: "holiday_config", value: { observed: observedHolidays } });
    setHolidaySaved(true);
    setTimeout(() => setHolidaySaved(false), 3000);
    toast({ title: "Holiday schedule saved" });
  }

  // ── A3: Salt Application Defaults ─────────────────────────────────────────
  const { data: saltDef } = useAppSetting("salt_defaults");
  const [saltFields, setSaltFields] = useState({
    surface_sqft: "",
    salt_rate_lb_per_1000sqft: "30",
    salt_cost_per_lb: "0.15",
    events_per_season: "20",
    minutes_per_application: "45",
  });
  const [saltSaved, setSaltSaved] = useState(false);

  useEffect(() => {
    if (saltDef) {
      setSaltFields({
        surface_sqft: String(saltDef.surface_sqft ?? ""),
        salt_rate_lb_per_1000sqft: String(saltDef.salt_rate_lb_per_1000sqft ?? "30"),
        salt_cost_per_lb: String(saltDef.salt_cost_per_lb ?? "0.15"),
        events_per_season: String(saltDef.events_per_season ?? "20"),
        minutes_per_application: String(saltDef.minutes_per_application ?? "45"),
      });
    }
  }, [saltDef]);

  async function saveSalt() {
    const value = Object.fromEntries(
      Object.entries(saltFields).map(([k, v]) => [k, parseFloat(v) || 0])
    );
    await save.mutateAsync({ key: "salt_defaults", value });
    setSaltSaved(true);
    setTimeout(() => setSaltSaved(false), 3000);
    toast({ title: "Salt defaults saved — will pre-fill the Salt Application calculator" });
  }

  // ── A4: Fertilizer Blackout Dates ─────────────────────────────────────────
  const { data: blackoutDef } = useAppSetting("fertilizer_blackouts");
  type BlackoutRange = { name: string; start: string; end: string };
  const [blackouts, setBlackouts] = useState<BlackoutRange[]>([]);
  const [blackoutSaved, setBlackoutSaved] = useState(false);

  useEffect(() => {
    if (Array.isArray(blackoutDef)) setBlackouts(blackoutDef);
  }, [blackoutDef]);

  function addBlackout() {
    setBlackouts(prev => [...prev, { name: "", start: "", end: "" }]);
  }

  function updateBlackout(i: number, field: keyof BlackoutRange, val: string) {
    setBlackouts(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b));
  }

  function removeBlackout(i: number) {
    setBlackouts(prev => prev.filter((_, idx) => idx !== i));
  }

  async function saveBlackouts() {
    const valid = blackouts.filter(b => b.name.trim() && b.start && b.end);
    if (valid.length !== blackouts.length) {
      toast({ title: "Fill in name, start, and end date for each blackout period", variant: "destructive" });
      return;
    }
    await save.mutateAsync({ key: "fertilizer_blackouts", value: valid });
    setBlackoutSaved(true);
    setTimeout(() => setBlackoutSaved(false), 3000);
    toast({ title: "Fertilizer blackout dates saved" });
  }

  // ── A5: Overtime Alert ────────────────────────────────────────────────────
  const { data: overtimeDef } = useAppSetting("overtime_alert_hours");
  const [overtimeHours, setOvertimeHours] = useState("8");
  const [overtimeSaved, setOvertimeSaved] = useState(false);

  useEffect(() => {
    if (overtimeDef !== null && overtimeDef !== undefined) {
      setOvertimeHours(String(overtimeDef));
    }
  }, [overtimeDef]);

  async function saveOvertime() {
    const val = parseFloat(overtimeHours);
    if (!isFinite(val) || val < 0) {
      toast({ title: "Enter 0 to disable, or a positive number of hours", variant: "destructive" });
      return;
    }
    await save.mutateAsync({ key: "overtime_alert_hours", value: val });
    setOvertimeSaved(true);
    setTimeout(() => setOvertimeSaved(false), 3000);
    toast({ title: val === 0 ? "Overtime alerts disabled" : `Overtime alert set at ${val}h` });
  }

  // ── A6: Default Break ─────────────────────────────────────────────────────
  const { data: breakDef } = useAppSetting("default_break_minutes");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [breakSaved, setBreakSaved] = useState(false);

  useEffect(() => {
    if (breakDef !== null && breakDef !== undefined) {
      setBreakMinutes(String(breakDef));
    }
  }, [breakDef]);

  async function saveBreak() {
    const val = parseInt(breakMinutes, 10);
    if (!isFinite(val) || val < 0) {
      toast({ title: "Enter 0 to disable, or a positive number of minutes", variant: "destructive" });
      return;
    }
    await save.mutateAsync({ key: "default_break_minutes", value: val });
    setBreakSaved(true);
    setTimeout(() => setBreakSaved(false), 3000);
    toast({ title: val === 0 ? "Break deduction disabled" : `${val}m break will be deducted from each session at clock-out` });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Regional &amp; Seasonal Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure location-based weather, company holiday schedule, seasonal job defaults, and time-tracking rules.
        </p>
      </div>

      {/* A1 — Weather Location */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4 text-blue-500" />
            A1 — Weather in Dispatch Calendar
            <SaveBadge saved={weatherSaved} />
          </CardTitle>
          <CardDescription>
            Set your company's coordinates so the dispatch calendar shows daily high/low temperatures and conditions.
            Uses the National Weather Service — US locations only. Find your coordinates at{" "}
            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              maps.google.com
            </a>{" "}
            (right-click a location → copy lat/lng).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div>
              <Label htmlFor="weather-city" className="text-xs mb-1 block">City / Location Name (display only)</Label>
              <Input
                id="weather-city"
                placeholder="e.g. Boston, MA"
                value={weatherCity}
                onChange={e => setWeatherCity(e.target.value)}
                data-testid="input-weather-city"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="weather-lat" className="text-xs mb-1 block">Latitude</Label>
                <Input
                  id="weather-lat"
                  placeholder="e.g. 42.3601"
                  value={weatherLat}
                  onChange={e => setWeatherLat(e.target.value)}
                  data-testid="input-weather-lat"
                />
              </div>
              <div>
                <Label htmlFor="weather-lng" className="text-xs mb-1 block">Longitude</Label>
                <Input
                  id="weather-lng"
                  placeholder="e.g. -71.0589"
                  value={weatherLng}
                  onChange={e => setWeatherLng(e.target.value)}
                  data-testid="input-weather-lng"
                />
              </div>
            </div>
          </div>
          {weatherLoc?.city && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              Currently set to: <span className="font-medium">{weatherLoc.city}</span>
              ({weatherLoc.lat}, {weatherLoc.lng})
            </div>
          )}
          <Button size="sm" onClick={saveWeather} disabled={save.isPending} data-testid="btn-save-weather">
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Location
          </Button>
        </CardContent>
      </Card>

      {/* A2 — Holiday Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-amber-500" />
            A2 — Company Holiday Schedule
            <SaveBadge saved={holidaySaved} />
          </CardTitle>
          <CardDescription>
            Check each US federal holiday your company observes (i.e., you are closed). Checked holidays will appear
            as banners in the dispatch calendar. Uncheck any holidays your crew works on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {US_FEDERAL_HOLIDAYS.map(h => (
              <label
                key={h.key}
                className="flex items-center gap-2.5 cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors"
                data-testid={`check-holiday-${h.key}`}
              >
                <Checkbox
                  checked={observedHolidays.includes(h.key)}
                  onCheckedChange={() => toggleHoliday(h.key)}
                />
                <div>
                  <p className="text-sm font-medium leading-none">{h.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{h.detail}</p>
                </div>
              </label>
            ))}
          </div>
          <Button size="sm" onClick={saveHolidays} disabled={save.isPending} data-testid="btn-save-holidays">
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Holiday Schedule
          </Button>
        </CardContent>
      </Card>

      {/* A3 — Salt Application Defaults */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sprout className="h-4 w-4 text-sky-500" />
            A3 — Salt Application Calculator Defaults
            <SaveBadge saved={saltSaved} />
          </CardTitle>
          <CardDescription>
            These values will automatically pre-fill the Salt Application calculator in estimates, saving your crew
            from re-entering common defaults every time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { field: "surface_sqft",               label: "Surface Area",            unit: "sq ft",          placeholder: "e.g. 10000" },
              { field: "salt_rate_lb_per_1000sqft",  label: "Salt Rate",               unit: "lb per 1,000 sf",placeholder: "e.g. 30" },
              { field: "salt_cost_per_lb",            label: "Salt Cost",               unit: "$/lb",           placeholder: "e.g. 0.15" },
              { field: "events_per_season",           label: "Events Per Season",       unit: "events",         placeholder: "e.g. 20" },
              { field: "minutes_per_application",    label: "Labor Per Application",   unit: "minutes",        placeholder: "e.g. 45" },
            ].map(({ field, label, unit, placeholder }) => (
              <div key={field}>
                <Label htmlFor={`salt-${field}`} className="text-xs mb-1 block">
                  {label} <span className="text-muted-foreground">({unit})</span>
                </Label>
                <Input
                  id={`salt-${field}`}
                  type="number"
                  min="0"
                  step="any"
                  placeholder={placeholder}
                  value={saltFields[field as keyof typeof saltFields]}
                  onChange={e => setSaltFields(prev => ({ ...prev, [field]: e.target.value }))}
                  data-testid={`input-salt-${field}`}
                />
              </div>
            ))}
          </div>
          <Button size="sm" onClick={saveSalt} disabled={save.isPending} data-testid="btn-save-salt">
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Salt Defaults
          </Button>
        </CardContent>
      </Card>

      {/* A4 — Fertilizer Blackout Dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Leaf className="h-4 w-4 text-green-600" />
            A4 — Fertilizer Blackout Dates
            <SaveBadge saved={blackoutSaved} />
          </CardTitle>
          <CardDescription>
            Define date ranges when fertilizer applications are restricted (e.g. summer heat, local ordinances). Days
            within a blackout period are flagged in the dispatch calendar with a warning indicator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blackouts.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No blackout periods defined.</p>
          )}
          {blackouts.map((b, i) => (
            <div key={i} className="flex items-end gap-2 p-3 border rounded-md bg-muted/20">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">Period Name</Label>
                <Input
                  placeholder="e.g. Summer Heat Blackout"
                  value={b.name}
                  onChange={e => updateBlackout(i, "name", e.target.value)}
                  data-testid={`input-blackout-name-${i}`}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Start Date</Label>
                <Input
                  type="date"
                  value={b.start}
                  onChange={e => updateBlackout(i, "start", e.target.value)}
                  data-testid={`input-blackout-start-${i}`}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">End Date</Label>
                <Input
                  type="date"
                  value={b.end}
                  onChange={e => updateBlackout(i, "end", e.target.value)}
                  data-testid={`input-blackout-end-${i}`}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-destructive shrink-0"
                onClick={() => removeBlackout(i)}
                data-testid={`btn-remove-blackout-${i}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addBlackout} data-testid="btn-add-blackout">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Blackout Period
            </Button>
            <Button size="sm" onClick={saveBlackouts} disabled={save.isPending} data-testid="btn-save-blackouts">
              <Save className="h-3.5 w-3.5 mr-1.5" /> Save Blackout Dates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* A5 — Overtime Alert */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-orange-500" />
            A5 — Overtime Alert Threshold
            <SaveBadge saved={overtimeSaved} />
          </CardTitle>
          <CardDescription>
            When an employee clocks out and their total hours for that day exceed this threshold, all Admins and
            Managers receive an in-app notification. Set to <strong>0</strong> to disable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="overtime-hours" className="text-xs mb-1 block">Daily Hours Threshold</Label>
              <Input
                id="overtime-hours"
                type="number"
                min="0"
                max="24"
                step="0.5"
                className="w-32"
                value={overtimeHours}
                onChange={e => setOvertimeHours(e.target.value)}
                data-testid="input-overtime-hours"
              />
            </div>
            <span className="text-sm text-muted-foreground mb-2">hours / day</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {parseFloat(overtimeHours) === 0
              ? "Overtime alerts are currently disabled."
              : `Alert fires when an employee exceeds ${overtimeHours}h in a single day.`}
          </p>
          <Button size="sm" onClick={saveOvertime} disabled={save.isPending} data-testid="btn-save-overtime">
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Overtime Rule
          </Button>
        </CardContent>
      </Card>

      {/* A6 — Default Break Deduction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Coffee className="h-4 w-4 text-amber-700" />
            A6 — Default Break Deduction
            <SaveBadge saved={breakSaved} />
          </CardTitle>
          <CardDescription>
            Automatically deduct this many minutes from each employee's session when they clock out. The deduction is
            always shown as a labeled line in time reports — it is <strong>never silent</strong>. Set to{" "}
            <strong>0</strong> to disable automatic deductions. Employees must still be logged at least 15 minutes
            beyond the break amount for the deduction to apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="break-minutes" className="text-xs mb-1 block">Break Duration</Label>
              <Input
                id="break-minutes"
                type="number"
                min="0"
                max="120"
                step="5"
                className="w-32"
                value={breakMinutes}
                onChange={e => setBreakMinutes(e.target.value)}
                data-testid="input-break-minutes"
              />
            </div>
            <span className="text-sm text-muted-foreground mb-2">minutes / session</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {parseInt(breakMinutes, 10) === 0
              ? "Automatic break deduction is currently disabled."
              : `${breakMinutes} minutes will be deducted from each clocked session at clock-out.`}
          </p>
          <Button size="sm" onClick={saveBreak} disabled={save.isPending} data-testid="btn-save-break">
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Break Rule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
